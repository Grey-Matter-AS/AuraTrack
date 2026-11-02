import 'fake-indexeddb/auto';
import { ids, seizureFixture, stripBase } from '@auratrack/model/fixtures';
import { describe, expect, it } from 'vitest';
import { createStoreApi } from './api';
import { AuraDb } from './db';
import { DecryptError, TEST_PIN_KDF } from './crypto';

let n = 0;
async function open() {
  const name = `video-${Date.now()}-${n++}`;
  const { api, store } = createStoreApi({ name, options: { pinKdf: TEST_PIN_KDF } });
  await api.create({ credential: { pin: '2468' } });
  const seizure = (await api.createRecord({
    type: 'seizure',
    values: stripBase(seizureFixture({ patientId: ids.patient })),
  })) as { id: string };
  return { api, store, name, seizure };
}
const bytes = (length: number) => Uint8Array.from({ length }, (_, i) => (i * 7) % 256);

describe('seizure videos', () => {
  it('keeps a video sealed, gives it back unchanged, and notes the file name on the seizure', async () => {
    const { api, seizure } = await open();
    const video = bytes(5000);
    await api.videoPut({ seizureId: seizure.id, mime: 'video/webm', bytes: video, fileName: 'seizure.webm' });
    const back = await api.videoGet({ seizureId: seizure.id });
    expect(back?.mime).toBe('video/webm');
    expect([...back!.bytes]).toEqual([...video]);
    expect(await api.videoList()).toEqual([{ seizureId: seizure.id, mime: 'video/webm', size: 5000 }]);
    expect((api.get({ type: 'seizure', id: seizure.id }) as { video: unknown }).video).toEqual({
      fileName: 'seizure.webm',
    });
  });

  it('writes nothing readable to the database', async () => {
    const { api, name, seizure } = await open();
    const video = new TextEncoder().encode('SECRET-VIDEO-CONTENT '.repeat(50));
    await api.videoPut({ seizureId: seizure.id, mime: 'video/mp4', bytes: video, fileName: 'a.mp4' });
    const raw = new AuraDb(name);
    const [row] = await raw.videos.toArray();
    raw.close();
    expect(new TextDecoder().decode(row!.data)).not.toContain('SECRET-VIDEO');
    expect(row!.data.byteLength).toBeGreaterThan(video.byteLength); // the authentication tag
  });

  it('a video moved to another seizure cannot be opened (it is bound to its seizure)', async () => {
    const { api, store, name, seizure } = await open();
    await api.videoPut({ seizureId: seizure.id, mime: 'video/webm', bytes: bytes(100), fileName: 'a.webm' });
    const raw = new AuraDb(name);
    const [row] = await raw.videos.toArray();
    await raw.videos.put({ ...row!, seizureId: 'someone-elses' });
    raw.close();
    await expect(store().getVideo('someone-elses')).rejects.toBeInstanceOf(DecryptError);
  });

  it('replaces an earlier video, and a missing video is null', async () => {
    const { api, seizure } = await open();
    expect(await api.videoGet({ seizureId: seizure.id })).toBeNull();
    await api.videoPut({ seizureId: seizure.id, mime: 'video/webm', bytes: bytes(10), fileName: 'one.webm' });
    await api.videoPut({ seizureId: seizure.id, mime: 'video/webm', bytes: bytes(20), fileName: 'two.webm' });
    expect((await api.videoGet({ seizureId: seizure.id }))?.bytes.byteLength).toBe(20);
    expect(await api.videoList()).toHaveLength(1);
  });

  it('refuses a video for a seizure that does not exist', async () => {
    const { api } = await open();
    await expect(
      api.videoPut({ seizureId: 'nope', mime: 'video/webm', bytes: bytes(1), fileName: 'x' }),
    ).rejects.toThrow('no such seizure');
  });

  it('deleting the video keeps the seizure, and deleting the seizure takes its video with it', async () => {
    const { api, seizure } = await open();
    await api.videoPut({ seizureId: seizure.id, mime: 'video/webm', bytes: bytes(10), fileName: 'a.webm' });
    await api.videoDelete({ seizureId: seizure.id });
    expect(await api.videoGet({ seizureId: seizure.id })).toBeNull();
    expect((api.get({ type: 'seizure', id: seizure.id }) as { video: unknown }).video).toBeNull();
    await api.videoPut({ seizureId: seizure.id, mime: 'video/webm', bytes: bytes(10), fileName: 'b.webm' });
    await api.remove({ type: 'seizure', id: seizure.id });
    expect(await api.videoList()).toEqual([]);
  });

  it('a store created before videos existed opens and takes videos (the new table touches nothing else)', async () => {
    const { api, name, seizure } = await open();
    api.lock();
    const { api: again } = createStoreApi({ name, options: { pinKdf: TEST_PIN_KDF } });
    await again.unlock({ credential: { pin: '2468' } });
    expect(again.get({ type: 'seizure', id: seizure.id })).not.toBeNull();
    await again.videoPut({ seizureId: seizure.id, mime: 'video/webm', bytes: bytes(10), fileName: 'a.webm' });
    expect(await again.videoList()).toHaveLength(1);
  });
});

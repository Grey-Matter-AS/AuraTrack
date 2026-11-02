import { expect, test } from '@playwright/test';

// Face ID / fingerprint through a passkey, with the browser's virtual authenticator (Chromium only: it is the one that can
// stand in for a phone's authenticator with the PRF extension).
test.skip(({ browserName }) => browserName !== 'chromium', 'virtual authenticators are a Chromium feature');

test('set up a passkey with the PIN, lock, and unlock with the passkey', async ({ page, context }) => {
  const cdp = await context.newCDPSession(page);
  await cdp.send('WebAuthn.enable');
  await cdp.send('WebAuthn.addVirtualAuthenticator', {
    options: {
      protocol: 'ctap2',
      transport: 'internal',
      hasResidentKey: true,
      hasUserVerification: true,
      isUserVerified: true,
      automaticPresenceSimulation: true,
      hasPrf: true,
    },
  });
  await page.goto('http://localhost:4173/#/app'); // a passkey needs a domain name, not an IP address
  await page.getByLabel('Name of the person being tracked').fill('Alex');
  await page.getByLabel('PIN (at least 4 digits)').fill('2468');
  await page.getByLabel('PIN again').fill('2468');
  await page.getByRole('button', { name: 'Create' }).click();
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible({ timeout: 30_000 });

  await page.getByLabel('Your PIN (to set it up)').fill('2468');
  await page.getByRole('button', { name: 'Set up Face ID or fingerprint' }).click();
  await expect(page.getByText('Face ID or fingerprint is set up')).toBeVisible();

  await page.getByRole('button', { name: 'Lock', exact: true }).click();
  await page.getByRole('button', { name: 'Unlock with Face ID or fingerprint' }).click();
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible({ timeout: 30_000 });

  // after a reload too
  await page.reload();
  await page.getByRole('button', { name: 'Unlock with Face ID or fingerprint' }).click();
  await expect(page.getByRole('button', { name: 'Start timer' })).toBeVisible({ timeout: 30_000 });
});

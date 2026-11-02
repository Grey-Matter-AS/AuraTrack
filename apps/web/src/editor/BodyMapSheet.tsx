import { BottomSheet, Button } from '@auratrack/ui';
import { useApp } from '../app/AppContext';
import { BodyMap } from './BodyMap';
import type { Area } from './draft';

/** The body map in a sheet, for places outside the seizure editor (the between-seizures log). */
export function BodyMapSheet({
  title,
  value,
  onChange,
  onClose,
}: {
  title: string;
  value: Area | null;
  onChange: (area: Area | null) => void;
  onClose: () => void;
}) {
  const { t } = useApp();
  return (
    <BottomSheet
      title={title}
      onClose={onClose}
      footer={
        <Button variant="primary" fullWidth onClick={onClose}>
          {t('common.done')}
        </Button>
      }
    >
      <BodyMap value={value} onChange={onChange} />
    </BottomSheet>
  );
}

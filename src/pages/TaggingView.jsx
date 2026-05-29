import React from 'react';
import { useTranslation } from 'react-i18next';
import { WizardMenu } from '../components/WizardMenu';
import { ScrollFade } from '../components/ScrollFade';
import Summary from '../components/Summary';
import { SYMPTOM_WIZARD, REGION_WIZARD, SEIZURE_TYPES } from '../data/constants';
import { db } from '../data/db';

export default function TaggingView({
  taggingStep, setTaggingStep,
  selections, setSelections,
  tempSymptomList, setTempSymptomList,
  notes, setNotes,
  triggers, triggerToggle,
  editingId, activeEventId,
  manualDurations, editedTimers, setManualDuration,
  overrideDateTime, isManualEntry, setEventDateTime,
  elapsed, laps, startTime,
  onSave, onCancel,
  durationFormat = 'seconds',
}) {
  const { t } = useTranslation();

  const handleTypeSelect = async (val) => {
    const targetId = editingId || activeEventId;
    if (!targetId) { console.error('No active event found'); return; }
    await db.events.update(targetId, { type: val });
    setSelections({ ...selections, type: val });
    setTaggingStep('S_CAT');
  };

  return (
    <div className={`flex-1 flex flex-col items-center w-full max-w-md sm:max-w-xl md:max-w-2xl ${taggingStep === 'SUMMARY' ? 'overflow-y-auto py-4 custom-scrollbar' : 'h-[calc(100dvh-2rem)] overflow-hidden'} animate-in fade-in slide-in-from-bottom-6`}>
      <div className={`w-full p-6 rounded-[2rem] shadow-2xl flex flex-col ${taggingStep !== 'SUMMARY' ? 'h-full min-h-0 overflow-hidden' : ''}`} style={{ backgroundColor: 'var(--bg-card)', border: '1px solid var(--border-subtle)' }}>

        {taggingStep === 'SUMMARY' ? (
          <div className="w-full">
            <Summary
              tempSymptomList={tempSymptomList}
              setTempSymptomList={setTempSymptomList}
              notes={notes}
              setNotes={setNotes}
              triggers={triggers}
              onTriggerToggle={triggerToggle}
              elapsed={elapsed}
              laps={laps}
              startTime={startTime}
              manualDurations={manualDurations}
              editedTimers={editedTimers}
              onSetManualDuration={setManualDuration}
              onAddAnother={() => setTaggingStep('S_CAT')}
              onSave={onSave}
              onCancel={onCancel}
              onRemoveSymptom={index => setTempSymptomList(tempSymptomList.filter((_, i) => i !== index))}
              editingId={editingId}
              isManualEntry={isManualEntry}
              overrideDateTime={overrideDateTime}
              onSetEventDateTime={setEventDateTime}
              durationFormat={durationFormat}
            />
          </div>
        ) : (
          <ScrollFade>

            {/* Step 1: Seizure Type */}
            {taggingStep === 'TYPE' && (
              <WizardMenu
                title={t('tagging.step1_title')}
                options={SEIZURE_TYPES}
                onPick={handleTypeSelect}
              />
            )}

            {/* Step 2-4: Symptom Drill-Down */}
            {taggingStep === 'S_CAT' && (
              <WizardMenu
                title={t('tagging.feeling_title')}
                options={Object.keys(SYMPTOM_WIZARD)}
                onPick={v => { setSelections({ ...selections, group: v }); setTaggingStep('S_SYM'); }}
              />
            )}
            {taggingStep === 'S_SYM' && selections.group && SYMPTOM_WIZARD[selections.group] && (
              <WizardMenu
                title={selections.group}
                options={Object.keys(SYMPTOM_WIZARD[selections.group])}
                onPick={v => { setSelections({ ...selections, symptom: v }); setTaggingStep('S_DET'); }}
                onBack={() => setTaggingStep('S_CAT')}
              />
            )}
            {taggingStep === 'S_DET' && selections.group && selections.symptom &&
              SYMPTOM_WIZARD[selections.group]?.[selections.symptom] && (
              <WizardMenu
                title={selections.symptom}
                options={SYMPTOM_WIZARD[selections.group][selections.symptom].options.map(o => o.label)}
                onPick={label => {
                  const optionObj = SYMPTOM_WIZARD[selections.group][selections.symptom].options.find(o => o.label === label);
                  const groupConfig = SYMPTOM_WIZARD[selections.group][selections.symptom];
                  const updatedSelections = {
                    ...selections,
                    detail: label,
                    medical: optionObj.med,
                    region: optionObj.forceRegion || '',
                    subRegion: optionObj.forceSubRegion || ''
                  };
                  setSelections(updatedSelections);

                  if (optionObj.forceSubRegion) {
                    setTaggingStep('R_DET');
                    return;
                  }
                  if (groupConfig.skipRegion) {
                    const bundle = {
                      symptom: selections.symptom,
                      detail: label,
                      med: optionObj.med,
                      region: 'N/A',
                      specificPart: 'Internal/General'
                    };
                    setTempSymptomList([...tempSymptomList, bundle]);
                    setTaggingStep('SUMMARY');
                  } else if (optionObj.forceRegion) {
                    setTaggingStep('R_SUB');
                  } else {
                    setTaggingStep('R_CAT');
                  }
                }}
                onBack={() => setTaggingStep('S_SYM')}
              />
            )}

            {/* Step 3-5: Region Drill-Down */}
            {taggingStep === 'R_CAT' && (
              <WizardMenu
                title={t('tagging.region_title')}
                options={Object.keys(REGION_WIZARD)}
                onPick={v => { setSelections({ ...selections, region: v }); setTaggingStep('R_SUB'); }}
              />
            )}
            {taggingStep === 'R_SUB' && selections.region && REGION_WIZARD[selections.region] && (
              <WizardMenu
                title={selections.region}
                options={Object.keys(REGION_WIZARD[selections.region])}
                onPick={v => { setSelections({ ...selections, subRegion: v }); setTaggingStep('R_DET'); }}
                onBack={() => {
                  const optionObj = SYMPTOM_WIZARD[selections.group]?.[selections.symptom]?.options.find(o => o.label === selections.detail);
                  setTaggingStep(optionObj?.forceRegion ? 'S_DET' : 'R_CAT');
                }}
              />
            )}
            {taggingStep === 'R_DET' && selections.region && selections.subRegion &&
              REGION_WIZARD[selections.region]?.[selections.subRegion] && (
              <WizardMenu
                title={selections.subRegion}
                options={REGION_WIZARD[selections.region][selections.subRegion]}
                onPick={v => {
                  const bundle = {
                    symptom: selections.symptom,
                    detail: selections.detail,
                    med: selections.medical,
                    region: selections.region,
                    specificPart: v
                  };
                  setTempSymptomList([...tempSymptomList, bundle]);
                  setTaggingStep('SUMMARY');
                }}
                onBack={() => {
                  const optionObj = SYMPTOM_WIZARD[selections.group]?.[selections.symptom]?.options.find(o => o.label === selections.detail);
                  setTaggingStep(optionObj?.forceSubRegion ? 'S_DET' : 'R_SUB');
                }}
              />
            )}

          </ScrollFade>
        )}

      </div>
    </div>
  );
}

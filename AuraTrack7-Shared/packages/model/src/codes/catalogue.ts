// The codes catalogue: every code the app stores, with its structure. Labels are in @auratrack/i18n (labels/<lang>.json).
// First built from 6.1's constants; since version 2 (2026-11-06, D-18) this file is the source and is edited by hand: no
// 6.1 labels, no plain-language seizure types, no ILAE 2017 codes. Codes are never renamed or reused; new ones are added.

export const CATALOGUE_VERSION = 2;

export const SYMPTOM_GROUPS = [
  {
    code: 'symptom_group.physical_movement.small_twitching',
    category: 'symptom_category.physical_movement',
    skipRegion: false,
  },
  {
    code: 'symptom_group.physical_movement.big_shaking_jerking',
    category: 'symptom_category.physical_movement',
    skipRegion: false,
  },
  {
    code: 'symptom_group.physical_movement.stiffening_locking',
    category: 'symptom_category.physical_movement',
    skipRegion: false,
  },
  {
    code: 'symptom_group.physical_movement.losing_control',
    category: 'symptom_category.physical_movement',
    skipRegion: false,
  },
  {
    code: 'symptom_group.physical_movement.automatic_habits',
    category: 'symptom_category.physical_movement',
    skipRegion: true,
  },
  {
    code: 'symptom_group.sensory_and_vision.skin_sensation',
    category: 'symptom_category.sensory_and_vision',
    skipRegion: false,
  },
  {
    code: 'symptom_group.sensory_and_vision.vision_eyes',
    category: 'symptom_category.sensory_and_vision',
    skipRegion: true,
  },
  {
    code: 'symptom_group.sensory_and_vision.hearing_and_smell',
    category: 'symptom_category.sensory_and_vision',
    skipRegion: true,
  },
  {
    code: 'symptom_group.internal_and_autonomic.stomach_and_chest',
    category: 'symptom_category.internal_and_autonomic',
    skipRegion: true,
  },
  {
    code: 'symptom_group.internal_and_autonomic.skin_and_temperature',
    category: 'symptom_category.internal_and_autonomic',
    skipRegion: true,
  },
  {
    code: 'symptom_group.head_and_face.face_and_mouth',
    category: 'symptom_category.head_and_face',
    skipRegion: false,
  },
  {
    code: 'symptom_group.head_and_face.eyes',
    category: 'symptom_category.head_and_face',
    skipRegion: false,
  },
  {
    code: 'symptom_group.mental_and_speech.awareness',
    category: 'symptom_category.mental_and_speech',
    skipRegion: true,
  },
  {
    code: 'symptom_group.mental_and_speech.talking',
    category: 'symptom_category.mental_and_speech',
    skipRegion: true,
  },
  {
    code: 'symptom_group.mental_and_speech.emotions_memory',
    category: 'symptom_category.mental_and_speech',
    skipRegion: true,
  },
] as const;
export const SYMPTOMS = [
  {
    code: 'symptom.small_twitching.muscle_flickering',
    group: 'symptom_group.physical_movement.small_twitching',
    medicalTerm: 'Fasciculation',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.small_twitching.single_muscle_jerks',
    group: 'symptom_group.physical_movement.small_twitching',
    medicalTerm: 'Myoclonic jerks',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.small_twitching.muscle_rippling',
    group: 'symptom_group.physical_movement.small_twitching',
    medicalTerm: 'Myokymia',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.big_shaking_jerking.rhythmic_shaking',
    group: 'symptom_group.physical_movement.big_shaking_jerking',
    medicalTerm: 'Clonic activity',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.big_shaking_jerking.violent_jolts',
    group: 'symptom_group.physical_movement.big_shaking_jerking',
    medicalTerm: 'Myoclonus',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.big_shaking_jerking.large_trembling',
    group: 'symptom_group.physical_movement.big_shaking_jerking',
    medicalTerm: 'Tremor',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.big_shaking_jerking.bicycling_kicking_legs',
    group: 'symptom_group.physical_movement.big_shaking_jerking',
    medicalTerm: 'Pedaling',
    forceRegion: 'body.legs',
    forceSubRegion: 'body.legs.general_legs',
  },
  {
    code: 'symptom.stiffening_locking.body_gone_rigid',
    group: 'symptom_group.physical_movement.stiffening_locking',
    medicalTerm: 'Tonic posturing',
    forceRegion: 'body.whole_body',
    forceSubRegion: 'body.whole_body.general',
  },
  {
    code: 'symptom.stiffening_locking.specific_limb_locked',
    group: 'symptom_group.physical_movement.stiffening_locking',
    medicalTerm: 'Focal Tonic',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.stiffening_locking.jaw_clenched_locked',
    group: 'symptom_group.physical_movement.stiffening_locking',
    medicalTerm: 'Trismus',
    forceRegion: 'body.head_and_face',
    forceSubRegion: 'body.head_and_face.mouth',
  },
  {
    code: 'symptom.stiffening_locking.arching_back',
    group: 'symptom_group.physical_movement.stiffening_locking',
    medicalTerm: 'Opisthotonus',
    forceRegion: 'body.torso',
    forceSubRegion: 'body.torso.front_back',
  },
  {
    code: 'symptom.losing_control.going_limp_dropping',
    group: 'symptom_group.physical_movement.losing_control',
    medicalTerm: 'Atonic event',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.losing_control.head_dropping_forward',
    group: 'symptom_group.physical_movement.losing_control',
    medicalTerm: 'Head drop',
    forceRegion: 'body.head_and_face',
    forceSubRegion: 'body.head_and_face.other',
  },
  {
    code: 'symptom.losing_control.slumping_to_one_side',
    group: 'symptom_group.physical_movement.losing_control',
    medicalTerm: 'Lateral tilt',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.losing_control.sudden_fall',
    group: 'symptom_group.physical_movement.losing_control',
    medicalTerm: 'Drop attack',
    forceRegion: 'body.whole_body',
    forceSubRegion: 'body.whole_body.general',
  },
  {
    code: 'symptom.automatic_habits.lip_smacking_chewing',
    group: 'symptom_group.physical_movement.automatic_habits',
    medicalTerm: 'Orofacial automatisms',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.automatic_habits.fidgeting_with_clothes',
    group: 'symptom_group.physical_movement.automatic_habits',
    medicalTerm: 'Manual automatisms',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.automatic_habits.wandering_pacing',
    group: 'symptom_group.physical_movement.automatic_habits',
    medicalTerm: 'Ambulatory automatisms',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.automatic_habits.repeating_a_gesture',
    group: 'symptom_group.physical_movement.automatic_habits',
    medicalTerm: 'Gestural automatisms',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.skin_sensation.tingling_pins_and_needles',
    group: 'symptom_group.sensory_and_vision.skin_sensation',
    medicalTerm: 'Paresthesia',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.skin_sensation.numbness',
    group: 'symptom_group.sensory_and_vision.skin_sensation',
    medicalTerm: 'Sensory deficit',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.skin_sensation.hot_or_cold_flash',
    group: 'symptom_group.sensory_and_vision.skin_sensation',
    medicalTerm: 'Thermal aura',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.skin_sensation.electric_shock_feeling',
    group: 'symptom_group.sensory_and_vision.skin_sensation',
    medicalTerm: 'Somatosensory aura',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.vision_eyes.flashing_lights_colors',
    group: 'symptom_group.sensory_and_vision.vision_eyes',
    medicalTerm: 'Visual hallucinations',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.vision_eyes.blurred_loss_of_vision',
    group: 'symptom_group.sensory_and_vision.vision_eyes',
    medicalTerm: 'Amaurosis',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.vision_eyes.things_look_bigger_smaller',
    group: 'symptom_group.sensory_and_vision.vision_eyes',
    medicalTerm: 'Metamorphopsia',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.vision_eyes.seeing_double',
    group: 'symptom_group.sensory_and_vision.vision_eyes',
    medicalTerm: 'Diplopia',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.hearing_and_smell.strange_smell',
    group: 'symptom_group.sensory_and_vision.hearing_and_smell',
    medicalTerm: 'Olfactory aura',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.hearing_and_smell.strange_taste',
    group: 'symptom_group.sensory_and_vision.hearing_and_smell',
    medicalTerm: 'Gustatory aura',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.hearing_and_smell.muffled_ring_sounds',
    group: 'symptom_group.sensory_and_vision.hearing_and_smell',
    medicalTerm: 'Auditory aura',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.hearing_and_smell.noises_sound_too_loud',
    group: 'symptom_group.sensory_and_vision.hearing_and_smell',
    medicalTerm: 'Hyperacusis',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.stomach_and_chest.rising_butterfly_feeling',
    group: 'symptom_group.internal_and_autonomic.stomach_and_chest',
    medicalTerm: 'Epigastric aura',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.stomach_and_chest.racing_heart',
    group: 'symptom_group.internal_and_autonomic.stomach_and_chest',
    medicalTerm: 'Tachycardia',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.stomach_and_chest.nausea_sick_feeling',
    group: 'symptom_group.internal_and_autonomic.stomach_and_chest',
    medicalTerm: 'Autonomic aura',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.stomach_and_chest.hard_to_breathe',
    group: 'symptom_group.internal_and_autonomic.stomach_and_chest',
    medicalTerm: 'Dyspnea',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.skin_and_temperature.sudden_sweating',
    group: 'symptom_group.internal_and_autonomic.skin_and_temperature',
    medicalTerm: 'Diaphoresis',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.skin_and_temperature.goosebumps',
    group: 'symptom_group.internal_and_autonomic.skin_and_temperature',
    medicalTerm: 'Piloerection',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.skin_and_temperature.turned_pale',
    group: 'symptom_group.internal_and_autonomic.skin_and_temperature',
    medicalTerm: 'Pallor',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.skin_and_temperature.turned_blue_purple',
    group: 'symptom_group.internal_and_autonomic.skin_and_temperature',
    medicalTerm: 'Cyanosis',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.skin_and_temperature.face_flushing_red',
    group: 'symptom_group.internal_and_autonomic.skin_and_temperature',
    medicalTerm: 'Flushing',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.face_and_mouth.drooling',
    group: 'symptom_group.head_and_face.face_and_mouth',
    medicalTerm: 'Sialorrhea',
    forceRegion: 'body.head_and_face',
    forceSubRegion: 'body.head_and_face.mouth',
  },
  {
    code: 'symptom.face_and_mouth.face_pulling_to_side',
    group: 'symptom_group.head_and_face.face_and_mouth',
    medicalTerm: 'Versive face',
    forceRegion: 'body.head_and_face',
    forceSubRegion: 'body.head_and_face.cheeks',
  },
  {
    code: 'symptom.face_and_mouth.unable_to_swallow',
    group: 'symptom_group.head_and_face.face_and_mouth',
    medicalTerm: 'Dysphagia',
    forceRegion: 'body.head_and_face',
    forceSubRegion: 'body.head_and_face.mouth',
  },
  {
    code: 'symptom.face_and_mouth.tongue_biting',
    group: 'symptom_group.head_and_face.face_and_mouth',
    medicalTerm: 'Lateral tongue trauma',
    forceRegion: 'body.head_and_face',
    forceSubRegion: 'body.head_and_face.mouth',
  },
  {
    code: 'symptom.eyes.staring_blankly',
    group: 'symptom_group.head_and_face.eyes',
    medicalTerm: 'Behavioral arrest',
    forceRegion: 'body.head_and_face',
    forceSubRegion: 'body.head_and_face.eyes',
  },
  {
    code: 'symptom.eyes.eyes_rolling_up',
    group: 'symptom_group.head_and_face.eyes',
    medicalTerm: 'Oculogyric crisis',
    forceRegion: 'body.head_and_face',
    forceSubRegion: 'body.head_and_face.eyes',
  },
  {
    code: 'symptom.eyes.rapid_blinking',
    group: 'symptom_group.head_and_face.eyes',
    medicalTerm: 'Eyelid myoclonia',
    forceRegion: 'body.head_and_face',
    forceSubRegion: 'body.head_and_face.eyes',
  },
  {
    code: 'symptom.eyes.eyes_pulled_to_side',
    group: 'symptom_group.head_and_face.eyes',
    medicalTerm: 'Versive gaze',
    forceRegion: 'body.head_and_face',
    forceSubRegion: 'body.head_and_face.eyes',
  },
  {
    code: 'symptom.eyes.dilated_pupils',
    group: 'symptom_group.head_and_face.eyes',
    medicalTerm: 'Mydriasis',
    forceRegion: 'body.head_and_face',
    forceSubRegion: 'body.head_and_face.eyes',
  },
  {
    code: 'symptom.awareness.fully_awake_aware',
    group: 'symptom_group.mental_and_speech.awareness',
    medicalTerm: 'Focal Aware',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.awareness.confused_dream_like',
    group: 'symptom_group.mental_and_speech.awareness',
    medicalTerm: 'Focal Impaired Awareness',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.awareness.total_blackout',
    group: 'symptom_group.mental_and_speech.awareness',
    medicalTerm: 'Generalized',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.talking.slurred_speech',
    group: 'symptom_group.mental_and_speech.talking',
    medicalTerm: 'Dysarthria',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.talking.mumbled_nonsense',
    group: 'symptom_group.mental_and_speech.talking',
    medicalTerm: 'Dysphasia',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.talking.unable_to_speak',
    group: 'symptom_group.mental_and_speech.talking',
    medicalTerm: 'Aphasia',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.talking.repeating_words',
    group: 'symptom_group.mental_and_speech.talking',
    medicalTerm: 'Palilalia',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.emotions_memory.deja_vu_been_here_before',
    group: 'symptom_group.mental_and_speech.emotions_memory',
    medicalTerm: 'Deja Vu',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.emotions_memory.strange_unfamiliarity',
    group: 'symptom_group.mental_and_speech.emotions_memory',
    medicalTerm: 'Jamais Vu',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.emotions_memory.sudden_fear_panic',
    group: 'symptom_group.mental_and_speech.emotions_memory',
    medicalTerm: 'Ictal fear',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.emotions_memory.sudden_laughter',
    group: 'symptom_group.mental_and_speech.emotions_memory',
    medicalTerm: 'Gelastic',
    forceRegion: null,
    forceSubRegion: null,
  },
  {
    code: 'symptom.emotions_memory.intense_peace_joy',
    group: 'symptom_group.mental_and_speech.emotions_memory',
    medicalTerm: 'Ecstatic',
    forceRegion: null,
    forceSubRegion: null,
  },
] as const;
export const BODY_REGIONS = [
  {
    code: 'body.whole_body',
    subRegions: [
      {
        code: 'body.whole_body.general',
        parts: [
          {
            code: 'body.whole_body.general.both_sides_equally',
          },
          {
            code: 'body.whole_body.general.starts_one_side_spreads',
          },
          {
            code: 'body.whole_body.general.alternating_sides',
          },
        ],
      },
    ],
  },
  {
    code: 'body.head_and_face',
    subRegions: [
      {
        code: 'body.head_and_face.eyes',
        parts: [
          {
            code: 'body.head_and_face.eyes.left_eye',
          },
          {
            code: 'body.head_and_face.eyes.right_eye',
          },
          {
            code: 'body.head_and_face.eyes.both_eyes',
          },
        ],
      },
      {
        code: 'body.head_and_face.mouth',
        parts: [
          {
            code: 'body.head_and_face.mouth.left_side',
          },
          {
            code: 'body.head_and_face.mouth.right_side',
          },
          {
            code: 'body.head_and_face.mouth.full_mouth',
          },
          {
            code: 'body.head_and_face.mouth.tongue',
          },
        ],
      },
      {
        code: 'body.head_and_face.cheeks',
        parts: [
          {
            code: 'body.head_and_face.cheeks.left_cheek',
          },
          {
            code: 'body.head_and_face.cheeks.right_cheek',
          },
          {
            code: 'body.head_and_face.cheeks.both_cheeks',
          },
        ],
      },
      {
        code: 'body.head_and_face.other',
        parts: [
          {
            code: 'body.head_and_face.other.back_of_head',
          },
          {
            code: 'body.head_and_face.other.top_of_head',
          },
          {
            code: 'body.head_and_face.other.neck',
          },
        ],
      },
    ],
  },
  {
    code: 'body.arms',
    subRegions: [
      {
        code: 'body.arms.left_arm',
        parts: [
          {
            code: 'body.arms.left_arm.whole_arm',
          },
          {
            code: 'body.arms.left_arm.shoulder',
          },
          {
            code: 'body.arms.left_arm.upper_arm',
          },
          {
            code: 'body.arms.left_arm.elbow',
          },
          {
            code: 'body.arms.left_arm.wrist',
          },
          {
            code: 'body.arms.left_arm.hand_fingers',
          },
        ],
      },
      {
        code: 'body.arms.right_arm',
        parts: [
          {
            code: 'body.arms.right_arm.whole_arm',
          },
          {
            code: 'body.arms.right_arm.shoulder',
          },
          {
            code: 'body.arms.right_arm.upper_arm',
          },
          {
            code: 'body.arms.right_arm.elbow',
          },
          {
            code: 'body.arms.right_arm.wrist',
          },
          {
            code: 'body.arms.right_arm.hand_fingers',
          },
        ],
      },
    ],
  },
  {
    code: 'body.legs',
    subRegions: [
      {
        code: 'body.legs.general_legs',
        parts: [
          {
            code: 'body.legs.general_legs.both_legs',
          },
          {
            code: 'body.legs.general_legs.starts_left_both',
          },
          {
            code: 'body.legs.general_legs.starts_right_both',
          },
        ],
      },
      {
        code: 'body.legs.left_leg',
        parts: [
          {
            code: 'body.legs.left_leg.whole_leg',
          },
          {
            code: 'body.legs.left_leg.hip_thigh',
          },
          {
            code: 'body.legs.left_leg.knee',
          },
          {
            code: 'body.legs.left_leg.ankle',
          },
          {
            code: 'body.legs.left_leg.foot_toes',
          },
        ],
      },
      {
        code: 'body.legs.right_leg',
        parts: [
          {
            code: 'body.legs.right_leg.whole_leg',
          },
          {
            code: 'body.legs.right_leg.hip_thigh',
          },
          {
            code: 'body.legs.right_leg.knee',
          },
          {
            code: 'body.legs.right_leg.ankle',
          },
          {
            code: 'body.legs.right_leg.foot_toes',
          },
        ],
      },
    ],
  },
  {
    code: 'body.torso',
    subRegions: [
      {
        code: 'body.torso.front_back',
        parts: [
          {
            code: 'body.torso.front_back.whole_torso',
          },
          {
            code: 'body.torso.front_back.chest_area',
          },
          {
            code: 'body.torso.front_back.stomach_area',
          },
          {
            code: 'body.torso.front_back.upper_back',
          },
          {
            code: 'body.torso.front_back.lower_back',
          },
        ],
      },
    ],
  },
] as const;
export const TRIGGERS = [
  {
    code: 'trigger.sleep_deprivation',
    factor: 'factor.sleeplessness',
  },
  {
    code: 'trigger.missed_medication',
    factor: 'factor.missed_medication',
  },
  {
    code: 'trigger.stress',
    factor: 'factor.stress',
  },
  {
    code: 'trigger.illness_fever',
    factor: 'factor.illness_fever',
  },
  {
    code: 'trigger.hormonal',
    factor: 'factor.hormonal_menstruation',
  },
  {
    code: 'trigger.alcohol',
    factor: null,
  },
  {
    code: 'trigger.flashing_lights',
    factor: null,
  },
  {
    code: 'trigger.heat',
    factor: null,
  },
  {
    code: 'trigger.exercise',
    factor: null,
  },
  {
    code: 'trigger.hunger',
    factor: null,
  },
  {
    code: 'trigger.unknown',
    factor: null,
  },
] as const;
export const FINDING_GROUPS = [
  {
    code: 'after_group.responsiveness',
    open: true,
  },
  {
    code: 'after_group.movement',
    open: true,
  },
  {
    code: 'after_group.sensation',
    open: false,
  },
  {
    code: 'after_group.speech',
    open: true,
  },
  {
    code: 'after_group.head',
    open: false,
  },
  {
    code: 'after_group.body',
    open: false,
  },
  {
    code: 'after_group.mood',
    open: false,
  },
  {
    code: 'after_group.other',
    open: false,
  },
] as const;
export const FINDINGS = [
  {
    code: 'after.not_responding',
    group: 'after_group.responsiveness',
    location: false,
  },
  {
    code: 'after.confused',
    group: 'after_group.responsiveness',
    location: false,
  },
  {
    code: 'after.drowsy',
    group: 'after_group.responsiveness',
    location: false,
  },
  {
    code: 'after.agitated',
    group: 'after_group.responsiveness',
    location: false,
  },
  {
    code: 'after.no_memory',
    group: 'after_group.responsiveness',
    location: false,
  },
  {
    code: 'after.paralysis',
    group: 'after_group.movement',
    location: true,
  },
  {
    code: 'after.weakness',
    group: 'after_group.movement',
    location: true,
  },
  {
    code: 'after.heaviness',
    group: 'after_group.movement',
    location: true,
  },
  {
    code: 'after.clumsiness',
    group: 'after_group.movement',
    location: true,
  },
  {
    code: 'after.numbness',
    group: 'after_group.sensation',
    location: true,
  },
  {
    code: 'after.tingling',
    group: 'after_group.sensation',
    location: true,
  },
  {
    code: 'after.pain',
    group: 'after_group.sensation',
    location: true,
  },
  {
    code: 'after.unable_to_speak',
    group: 'after_group.speech',
    location: false,
  },
  {
    code: 'after.slurred_speech',
    group: 'after_group.speech',
    location: false,
  },
  {
    code: 'after.word_finding',
    group: 'after_group.speech',
    location: false,
  },
  {
    code: 'after.headache',
    group: 'after_group.head',
    location: false,
  },
  {
    code: 'after.vision_changes',
    group: 'after_group.head',
    location: false,
  },
  {
    code: 'after.nausea',
    group: 'after_group.body',
    location: false,
  },
  {
    code: 'after.incontinence',
    group: 'after_group.body',
    location: false,
  },
  {
    code: 'after.tongue_bite',
    group: 'after_group.body',
    location: false,
  },
  {
    code: 'after.injury',
    group: 'after_group.body',
    location: true,
  },
  {
    code: 'after.exhaustion',
    group: 'after_group.body',
    location: false,
  },
  {
    code: 'after.anxious',
    group: 'after_group.mood',
    location: false,
  },
  {
    code: 'after.low_mood',
    group: 'after_group.mood',
    location: false,
  },
  {
    code: 'after.unusual_behaviour',
    group: 'after_group.mood',
    location: false,
  },
  {
    code: 'after.custom',
    group: 'after_group.other',
    location: false,
  },
] as const;
export const MOODS = [
  {
    code: 'mood.happy',
  },
  {
    code: 'mood.calm',
  },
  {
    code: 'mood.content',
  },
  {
    code: 'mood.sad_low',
  },
  {
    code: 'mood.anxious_worried',
  },
  {
    code: 'mood.stressed_overloaded',
  },
  {
    code: 'mood.irritable_angry',
  },
  {
    code: 'mood.restless_agitated',
  },
  {
    code: 'mood.tired_sleepy',
  },
  {
    code: 'mood.confused',
  },
  {
    code: 'mood.emotionally_flat',
  },
  {
    code: 'mood.very_happy_euphoric',
  },
] as const;
export const WELLBEING_FACTORS = [
  {
    code: 'factor.sleep_hours',
    type: 'number',
    unit: 'h',
  },
  {
    code: 'factor.sleep_quality',
    type: 'scale',
    unit: '',
  },
  {
    code: 'factor.sleeplessness',
    type: 'boolean',
    unit: '',
  },
  {
    code: 'factor.missed_bowel_movement',
    type: 'boolean',
    unit: '',
  },
  {
    code: 'factor.stress',
    type: 'scale',
    unit: '',
  },
  {
    code: 'factor.illness_fever',
    type: 'boolean',
    unit: '',
  },
  {
    code: 'factor.missed_medication',
    type: 'boolean',
    unit: '',
  },
  {
    code: 'factor.hormonal_menstruation',
    type: 'boolean',
    unit: '',
  },
  {
    code: 'factor.unusual_activity',
    type: 'boolean',
    unit: '',
  },
  {
    code: 'factor.tearful_crying',
    type: 'boolean',
    unit: '',
  },
] as const;
export const EEG_ACTIVITIES = [
  {
    code: 'activity.sleeping',
  },
  {
    code: 'activity.resting',
  },
  {
    code: 'activity.lying_down',
  },
  {
    code: 'activity.napping',
  },
  {
    code: 'activity.waking_up',
  },
  {
    code: 'activity.getting_out_of_bed',
  },
  {
    code: 'activity.eating_breakfast',
  },
  {
    code: 'activity.eating_lunch',
  },
  {
    code: 'activity.eating_dinner',
  },
  {
    code: 'activity.snacking',
  },
  {
    code: 'activity.drinking_water',
  },
  {
    code: 'activity.drinking_coffee',
  },
  {
    code: 'activity.drinking_tea',
  },
  {
    code: 'activity.cooking',
  },
  {
    code: 'activity.baking',
  },
  {
    code: 'activity.brushing_teeth',
  },
  {
    code: 'activity.showering',
  },
  {
    code: 'activity.bathing',
  },
  {
    code: 'activity.washing_hair',
  },
  {
    code: 'activity.getting_dressed',
  },
  {
    code: 'activity.undressing',
  },
  {
    code: 'activity.using_the_bathroom',
  },
  {
    code: 'activity.taking_medication',
  },
  {
    code: 'activity.walking_indoors',
  },
  {
    code: 'activity.walking_outdoors',
  },
  {
    code: 'activity.hiking',
  },
  {
    code: 'activity.jogging',
  },
  {
    code: 'activity.running',
  },
  {
    code: 'activity.cycling',
  },
  {
    code: 'activity.stretching',
  },
  {
    code: 'activity.yoga',
  },
  {
    code: 'activity.exercise',
  },
  {
    code: 'activity.gym_workout',
  },
  {
    code: 'activity.strength_training',
  },
  {
    code: 'activity.cleaning',
  },
  {
    code: 'activity.laundry',
  },
  {
    code: 'activity.dishwashing',
  },
  {
    code: 'activity.vacuuming',
  },
  {
    code: 'activity.gardening',
  },
  {
    code: 'activity.shopping',
  },
  {
    code: 'activity.driving',
  },
  {
    code: 'activity.riding_in_a_car',
  },
  {
    code: 'activity.bus_travel',
  },
  {
    code: 'activity.train_travel',
  },
  {
    code: 'activity.air_travel',
  },
  {
    code: 'activity.commuting',
  },
  {
    code: 'activity.working_at_desk',
  },
  {
    code: 'activity.working_from_home',
  },
  {
    code: 'activity.office_work',
  },
  {
    code: 'activity.manual_labor',
  },
  {
    code: 'activity.studying',
  },
  {
    code: 'activity.attending_class',
  },
  {
    code: 'activity.reading',
  },
  {
    code: 'activity.writing',
  },
  {
    code: 'activity.typing',
  },
  {
    code: 'activity.using_computer',
  },
  {
    code: 'activity.using_phone',
  },
  {
    code: 'activity.video_call',
  },
  {
    code: 'activity.phone_call',
  },
  {
    code: 'activity.texting',
  },
  {
    code: 'activity.watching_tv',
  },
  {
    code: 'activity.watching_movie',
  },
  {
    code: 'activity.watching_video',
  },
  {
    code: 'activity.listening_to_music',
  },
  {
    code: 'activity.listening_to_podcast',
  },
  {
    code: 'activity.gaming',
  },
  {
    code: 'activity.drawing',
  },
  {
    code: 'activity.painting',
  },
  {
    code: 'activity.pottery',
  },
  {
    code: 'activity.crafts',
  },
  {
    code: 'activity.knitting',
  },
  {
    code: 'activity.sewing',
  },
  {
    code: 'activity.photography',
  },
  {
    code: 'activity.playing_instrument',
  },
  {
    code: 'activity.singing',
  },
  {
    code: 'activity.dancing',
  },
  {
    code: 'activity.meditating',
  },
  {
    code: 'activity.praying',
  },
  {
    code: 'activity.socializing',
  },
  {
    code: 'activity.talking_with_family',
  },
  {
    code: 'activity.talking_with_friends',
  },
  {
    code: 'activity.childcare',
  },
  {
    code: 'activity.pet_care',
  },
  {
    code: 'activity.feeding_pet',
  },
  {
    code: 'activity.walking_dog',
  },
  {
    code: 'activity.eating_out',
  },
  {
    code: 'activity.restaurant_visit',
  },
  {
    code: 'activity.appointment',
  },
  {
    code: 'activity.hospital_visit',
  },
  {
    code: 'activity.doctor_visit',
  },
  {
    code: 'activity.therapy_session',
  },
  {
    code: 'activity.waiting',
  },
  {
    code: 'activity.standing',
  },
  {
    code: 'activity.sitting',
  },
  {
    code: 'activity.reclining',
  },
  {
    code: 'activity.sun_exposure',
  },
  {
    code: 'activity.swimming',
  },
  {
    code: 'activity.being_outdoors',
  },
  {
    code: 'activity.being_in_crowds',
  },
  {
    code: 'activity.shopping_online',
  },
  {
    code: 'activity.household_admin',
  },
  {
    code: 'activity.paying_bills',
  },
  {
    code: 'activity.organizing',
  },
  {
    code: 'activity.travel_preparation',
  },
  {
    code: 'activity.packing',
  },
] as const;
export const MEDICATION_FORMS = [
  {
    code: 'form.tablet',
  },
  {
    code: 'form.capsule',
  },
  {
    code: 'form.liquid',
  },
  {
    code: 'form.granules',
  },
  {
    code: 'form.buccal',
  },
  {
    code: 'form.nasal',
  },
  {
    code: 'form.rectal',
  },
  {
    code: 'form.injection',
  },
  {
    code: 'form.patch',
  },
  {
    code: 'form.other',
  },
] as const;

export const SYMPTOM_WIZARD = {
  "Physical Movement": {
    "Small Twitching": {
      skipRegion: false,
      options: [
        { label: "Muscle Flickering", med: "Fasciculation" },
        { label: "Single Muscle Jerks", med: "Myoclonic jerks" },
        { label: "Muscle Rippling", med: "Myokymia" },
        { label: "Eye/Lid Twitching", med: "Eyelid myoclonia", forceRegion: "Head & Face", forceSubRegion: "Eyes" }
      ]
    },
    "Big Shaking/Jerking": {
      skipRegion: false,
      options: [
        { label: "Rhythmic Shaking", med: "Clonic activity" },
        { label: "Violent Jolts", med: "Myoclonus" },
        { label: "Large Trembling", med: "Tremor" },
        { label: "Bicycling/Kicking legs", med: "Pedaling", forceRegion: "Legs", forceSubRegion: "General Legs" }
      ]
    },
    "Stiffening/Locking": {
      skipRegion: false,
      options: [
        { label: "Body gone rigid", med: "Tonic posturing", forceRegion: "Whole Body", forceSubRegion: "General" },
        { label: "Specific limb locked", med: "Focal Tonic" },
        { label: "Jaw Clenched/Locked", med: "Trismus", forceRegion: "Head & Face", forceSubRegion: "Mouth" },
        { label: "Arching Back", med: "Opisthotonus", forceRegion: "Torso", forceSubRegion: "Front/Back" }
      ]
    },
    "Losing Control": {
      skipRegion: false,
      options: [
        { label: "Going Limp/Dropping", med: "Atonic event" },
        { label: "Head Dropping Forward", med: "Head drop", forceRegion: "Head & Face", forceSubRegion: "Other" },
        { label: "Slumping to one side", med: "Lateral tilt" },
        { label: "Sudden Fall", med: "Drop attack", forceRegion: "Whole Body", forceSubRegion: "General" }
      ]
    },
    "Automatic Habits": {
      skipRegion: true,
      options: [
        { label: "Lip Smacking/Chewing", med: "Orofacial automatisms" },
        { label: "Fidgeting with clothes", med: "Manual automatisms" },
        { label: "Wandering/Pacing", med: "Ambulatory automatisms" },
        { label: "Repeating a gesture", med: "Gestural automatisms" }
      ]
    }
  },
  "Sensory & Vision": {
    "Skin Sensation": {
      skipRegion: false,
      options: [
        { label: "Tingling/Pins & Needles", med: "Paresthesia" },
        { label: "Numbness", med: "Sensory deficit" },
        { label: "Hot or Cold Flash", med: "Thermal aura" },
        { label: "Electric Shock feeling", med: "Somatosensory aura" }
      ]
    },
    "Vision/Eyes": {
      skipRegion: true,
      options: [
        { label: "Flashing Lights/Colors", med: "Visual hallucinations" },
        { label: "Blurred/Loss of vision", med: "Amaurosis" },
        { label: "Things look bigger/smaller", med: "Metamorphopsia" },
        { label: "Seeing double", med: "Diplopia" }
      ]
    },
    "Hearing & Smell": {
      skipRegion: true,
      options: [
        { label: "Strange Smell", med: "Olfactory aura" },
        { label: "Strange Taste", med: "Gustatory aura" },
        { label: "Muffled/Ring sounds", med: "Auditory aura" },
        { label: "Noises sound too loud", med: "Hyperacusis" }
      ]
    }
  },
  "Internal & Autonomic": {
    "Stomach & Chest": {
      skipRegion: true,
      options: [
        { label: "Rising 'Butterfly' feeling", med: "Epigastric aura" },
        { label: "Racing Heart", med: "Tachycardia" },
        { label: "Nausea/Sick feeling", med: "Autonomic aura" },
        { label: "Hard to breathe", med: "Dyspnea" }
      ]
    },
    "Skin & Temperature": {
      skipRegion: true,
      options: [
        { label: "Sudden Sweating", med: "Diaphoresis" },
        { label: "Goosebumps", med: "Piloerection" },
        { label: "Turned Pale", med: "Pallor" },
        { label: "Turned Blue/Purple", med: "Cyanosis" },
        { label: "Face Flushing Red", med: "Flushing" }
      ]
    }
  },
  "Head & Face": {
    "Face & Mouth": {
      skipRegion: false,
      options: [
        { label: "Drooling", med: "Sialorrhea", forceRegion: "Head & Face", forceSubRegion: "Mouth" },
        { label: "Face pulling to side", med: "Versive face", forceRegion: "Head & Face", forceSubRegion: "Cheeks" },
        { label: "Unable to swallow", med: "Dysphagia", forceRegion: "Head & Face", forceSubRegion: "Mouth" },
        { label: "Tongue Biting", med: "Lateral tongue trauma", forceRegion: "Head & Face", forceSubRegion: "Mouth" }
      ]
    },
    "Eyes": {
      skipRegion: false,
      options: [
        { label: "Staring Blankly", med: "Behavioral arrest", forceRegion: "Head & Face", forceSubRegion: "Eyes" },
        { label: "Eyes rolling up", med: "Oculogyric crisis", forceRegion: "Head & Face", forceSubRegion: "Eyes" },
        { label: "Rapid Blinking", med: "Eyelid myoclonia", forceRegion: "Head & Face", forceSubRegion: "Eyes" },
        { label: "Eyes pulled to side", med: "Versive gaze", forceRegion: "Head & Face", forceSubRegion: "Eyes" },
        { label: "Dilated pupils", med: "Mydriasis", forceRegion: "Head & Face", forceSubRegion: "Eyes" }
      ]
    }
  },
  "Mental & Speech": {
    "Awareness": {
      skipRegion: true,
      options: [
        { label: "Fully Awake/Aware", med: "Focal Aware" },
        { label: "Confused/Dream-like", med: "Focal Impaired Awareness" },
        { label: "Total Blackout", med: "Generalized" }
      ]
    },
    "Talking": {
      skipRegion: true,
      options: [
        { label: "Slurred Speech", med: "Dysarthria" },
        { label: "Mumbled/Nonsense", med: "Dysphasia" },
        { label: "Unable to speak", med: "Aphasia" },
        { label: "Repeating words", med: "Palilalia" }
      ]
    },
    "Emotions/Memory": {
      skipRegion: true,
      options: [
        { label: "Deja Vu (Been here before)", med: "Deja Vu" },
        { label: "Strange Unfamiliarity", med: "Jamais Vu" },
        { label: "Sudden Fear/Panic", med: "Ictal fear" },
        { label: "Sudden Laughter", med: "Gelastic" },
        { label: "Intense Peace/Joy", med: "Ecstatic" }
      ]
    }
  }
};

export const REGION_WIZARD = {
  "Whole Body": {
    "General": ["Both Sides Equally", "Starts one side -> Spreads", "Alternating Sides"]
  },
  "Head & Face": {
    "Eyes": ["Left Eye", "Right Eye", "Both Eyes"],
    "Mouth": ["Left Side", "Right Side", "Full Mouth", "Tongue"],
    "Cheeks": ["Left Cheek", "Right Cheek", "Both Cheeks"],
    "Other": ["Back of Head", "Top of Head", "Neck"]
  },
  "Arms": {
    "Left Arm": ["Whole Arm", "Shoulder", "Upper Arm", "Elbow", "Wrist", "Hand/Fingers"],
    "Right Arm": ["Whole Arm", "Shoulder", "Upper Arm", "Elbow", "Wrist", "Hand/Fingers"]
  },
  "Legs": {
    "General Legs": ["Both Legs", "Starts Left -> Both", "Starts Right -> Both"],
    "Left Leg": ["Whole Leg", "Hip/Thigh", "Knee", "Ankle", "Foot/Toes"],
    "Right Leg": ["Whole Leg", "Hip/Thigh", "Knee", "Ankle", "Foot/Toes"]
  },
  "Torso": {
    "Front/Back": ["Whole Torso", "Chest Area", "Stomach Area", "Upper Back", "Lower Back"]
  }
};

export const SEIZURE_TYPES = [
  'Tonic-Clonic',
  'Focal Aware',
  'Focal Impaired',
  'Absence',
  'Aura Only'
];

export const TRIGGERS = [
  'Sleep Deprivation',
  'Missed Medication',
  'Stress',
  'Illness / Fever',
  'Hormonal',
  'Alcohol',
  'Flashing Lights',
  'Heat / Overheating',
  'Exercise',
  'Hunger / Low Blood Sugar',
  'Unknown',
];

export const EEG_MOOD_OPTIONS = [
  'Calm',
  'Anxious',
  'Stressed',
  'Irritable',
  'Sad',
  'Tearful',
  'Elevated',
  'Agitated',
  'Fatigued',
  'Sleepy',
  'Alert',
  'Distracted',
  'Overwhelmed',
  'Frustrated',
  'Fearful',
  'Apathetic',
  'Restless',
  'Content',
  'Confused',
  'Emotionally Flat',
];

export const EEG_ACTIVITY_OPTIONS = [
  'Sleeping',
  'Resting',
  'Lying down',
  'Napping',
  'Waking up',
  'Getting out of bed',
  'Eating breakfast',
  'Eating lunch',
  'Eating dinner',
  'Snacking',
  'Drinking water',
  'Drinking coffee',
  'Drinking tea',
  'Cooking',
  'Baking',
  'Brushing teeth',
  'Showering',
  'Bathing',
  'Washing hair',
  'Getting dressed',
  'Undressing',
  'Using the bathroom',
  'Taking medication',
  'Walking indoors',
  'Walking outdoors',
  'Hiking',
  'Jogging',
  'Running',
  'Cycling',
  'Stretching',
  'Yoga',
  'Exercise',
  'Gym workout',
  'Strength training',
  'Cleaning',
  'Laundry',
  'Dishwashing',
  'Vacuuming',
  'Gardening',
  'Shopping',
  'Driving',
  'Riding in a car',
  'Bus travel',
  'Train travel',
  'Air travel',
  'Commuting',
  'Working at desk',
  'Working from home',
  'Office work',
  'Manual labor',
  'Studying',
  'Attending class',
  'Reading',
  'Writing',
  'Typing',
  'Using computer',
  'Using phone',
  'Video call',
  'Phone call',
  'Texting',
  'Watching TV',
  'Watching movie',
  'Watching video',
  'Listening to music',
  'Listening to podcast',
  'Gaming',
  'Drawing',
  'Painting',
  'Pottery',
  'Crafts',
  'Knitting',
  'Sewing',
  'Photography',
  'Playing instrument',
  'Singing',
  'Dancing',
  'Meditating',
  'Praying',
  'Socializing',
  'Talking with family',
  'Talking with friends',
  'Childcare',
  'Pet care',
  'Feeding pet',
  'Walking dog',
  'Eating out',
  'Restaurant visit',
  'Appointment',
  'Hospital visit',
  'Doctor visit',
  'Therapy session',
  'Waiting',
  'Standing',
  'Sitting',
  'Reclining',
  'Sun exposure',
  'Swimming',
  'Being outdoors',
  'Being in crowds',
  'Shopping online',
  'Household admin',
  'Paying bills',
  'Organizing',
  'Travel preparation',
  'Packing',
];

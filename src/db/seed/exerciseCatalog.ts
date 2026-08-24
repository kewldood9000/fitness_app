import type { Exercise } from '@/types/models'

export type BuiltinExerciseDefinition = Pick<Exercise, 'name' | 'primaryMuscle' | 'secondaryMuscles' | 'equipment' | 'category'>

const strength = (
  name: string,
  primaryMuscle: string,
  equipment: string,
  secondaryMuscles: string[] = []
): BuiltinExerciseDefinition => ({ name, primaryMuscle, secondaryMuscles, equipment, category: 'Strength' })

const cardio = (name: string, equipment: string): BuiltinExerciseDefinition => ({
  name,
  primaryMuscle: 'Other',
  secondaryMuscles: [],
  equipment,
  category: 'Cardio'
})

export const builtinExerciseCatalog: readonly BuiltinExerciseDefinition[] = [
  strength('Barbell Bench Press', 'Chest', 'Barbell', ['Triceps', 'Shoulders']),
  strength('Incline Barbell Bench Press', 'Chest', 'Barbell', ['Shoulders', 'Triceps']),
  strength('Decline Barbell Bench Press', 'Chest', 'Barbell', ['Triceps']),
  strength('Dumbbell Bench Press', 'Chest', 'Dumbbell', ['Triceps', 'Shoulders']),
  strength('Incline Dumbbell Bench Press', 'Chest', 'Dumbbell', ['Shoulders', 'Triceps']),
  strength('Dumbbell Fly', 'Chest', 'Dumbbell', ['Shoulders']),
  strength('Cable Fly', 'Chest', 'Cable', ['Shoulders']),
  strength('Low-to-High Cable Fly', 'Chest', 'Cable', ['Shoulders']),
  strength('Pec Deck', 'Chest', 'Machine'),
  strength('Machine Chest Press', 'Chest', 'Machine', ['Triceps', 'Shoulders']),
  strength('Push-Up', 'Chest', 'Bodyweight', ['Triceps', 'Shoulders', 'Abs']),
  strength('Chest Dip', 'Chest', 'Bodyweight', ['Triceps', 'Shoulders']),

  strength('Pull-Up', 'Back', 'Bodyweight', ['Biceps']),
  strength('Chin-Up', 'Back', 'Bodyweight', ['Biceps']),
  strength('Lat Pulldown', 'Back', 'Cable', ['Biceps']),
  strength('Neutral-Grip Lat Pulldown', 'Back', 'Cable', ['Biceps']),
  strength('Barbell Bent-Over Row', 'Back', 'Barbell', ['Biceps', 'Hamstrings']),
  strength('Pendlay Row', 'Back', 'Barbell', ['Biceps']),
  strength('One-Arm Dumbbell Row', 'Back', 'Dumbbell', ['Biceps']),
  strength('Chest-Supported Dumbbell Row', 'Back', 'Dumbbell', ['Biceps']),
  strength('Seated Cable Row', 'Back', 'Cable', ['Biceps']),
  strength('T-Bar Row', 'Back', 'Machine', ['Biceps']),
  strength('Machine Row', 'Back', 'Machine', ['Biceps']),
  strength('Straight-Arm Pulldown', 'Back', 'Cable', ['Triceps']),
  strength('Dumbbell Pullover', 'Back', 'Dumbbell', ['Chest', 'Triceps']),
  strength('Back Extension', 'Back', 'Bodyweight', ['Glutes', 'Hamstrings']),

  strength('Barbell Overhead Press', 'Shoulders', 'Barbell', ['Triceps']),
  strength('Dumbbell Shoulder Press', 'Shoulders', 'Dumbbell', ['Triceps']),
  strength('Arnold Press', 'Shoulders', 'Dumbbell', ['Triceps']),
  strength('Machine Shoulder Press', 'Shoulders', 'Machine', ['Triceps']),
  strength('Dumbbell Lateral Raise', 'Shoulders', 'Dumbbell'),
  strength('Cable Lateral Raise', 'Shoulders', 'Cable'),
  strength('Dumbbell Front Raise', 'Shoulders', 'Dumbbell'),
  strength('Rear Delt Dumbbell Fly', 'Shoulders', 'Dumbbell', ['Back']),
  strength('Reverse Pec Deck', 'Shoulders', 'Machine', ['Back']),
  strength('Face Pull', 'Shoulders', 'Cable', ['Back']),
  strength('Barbell Upright Row', 'Shoulders', 'Barbell', ['Biceps']),

  strength('Barbell Curl', 'Biceps', 'Barbell', ['Forearms']),
  strength('EZ-Bar Curl', 'Biceps', 'Barbell', ['Forearms']),
  strength('Dumbbell Curl', 'Biceps', 'Dumbbell', ['Forearms']),
  strength('Hammer Curl', 'Biceps', 'Dumbbell', ['Forearms']),
  strength('Incline Dumbbell Curl', 'Biceps', 'Dumbbell', ['Forearms']),
  strength('Preacher Curl', 'Biceps', 'Machine', ['Forearms']),
  strength('Cable Curl', 'Biceps', 'Cable', ['Forearms']),
  strength('Concentration Curl', 'Biceps', 'Dumbbell', ['Forearms']),

  strength('Cable Triceps Pushdown', 'Triceps', 'Cable'),
  strength('Rope Triceps Pushdown', 'Triceps', 'Cable'),
  strength('Overhead Cable Triceps Extension', 'Triceps', 'Cable'),
  strength('Dumbbell Overhead Triceps Extension', 'Triceps', 'Dumbbell'),
  strength('Skull Crusher', 'Triceps', 'Barbell'),
  strength('Close-Grip Bench Press', 'Triceps', 'Barbell', ['Chest', 'Shoulders']),
  strength('Triceps Dip', 'Triceps', 'Bodyweight', ['Chest', 'Shoulders']),
  strength('Dumbbell Triceps Kickback', 'Triceps', 'Dumbbell'),

  strength('Barbell Back Squat', 'Quads', 'Barbell', ['Glutes', 'Hamstrings', 'Abs']),
  strength('Barbell Front Squat', 'Quads', 'Barbell', ['Glutes', 'Abs']),
  strength('Goblet Squat', 'Quads', 'Dumbbell', ['Glutes', 'Abs']),
  strength('Leg Press', 'Quads', 'Machine', ['Glutes', 'Hamstrings']),
  strength('Hack Squat', 'Quads', 'Machine', ['Glutes']),
  strength('Bulgarian Split Squat', 'Quads', 'Dumbbell', ['Glutes', 'Hamstrings']),
  strength('Reverse Lunge', 'Quads', 'Dumbbell', ['Glutes', 'Hamstrings']),
  strength('Walking Lunge', 'Quads', 'Dumbbell', ['Glutes', 'Hamstrings']),
  strength('Step-Up', 'Quads', 'Dumbbell', ['Glutes']),
  strength('Leg Extension', 'Quads', 'Machine'),
  strength('Wall Sit', 'Quads', 'Bodyweight', ['Glutes']),

  strength('Conventional Deadlift', 'Hamstrings', 'Barbell', ['Glutes', 'Back', 'Forearms']),
  strength('Romanian Deadlift', 'Hamstrings', 'Barbell', ['Glutes', 'Back']),
  strength('Dumbbell Romanian Deadlift', 'Hamstrings', 'Dumbbell', ['Glutes', 'Back']),
  strength('Stiff-Leg Deadlift', 'Hamstrings', 'Barbell', ['Glutes', 'Back']),
  strength('Seated Leg Curl', 'Hamstrings', 'Machine'),
  strength('Lying Leg Curl', 'Hamstrings', 'Machine'),
  strength('Good Morning', 'Hamstrings', 'Barbell', ['Glutes', 'Back']),
  strength('Nordic Hamstring Curl', 'Hamstrings', 'Bodyweight', ['Glutes']),
  strength('Kettlebell Swing', 'Hamstrings', 'Other', ['Glutes', 'Back']),

  strength('Barbell Hip Thrust', 'Glutes', 'Barbell', ['Hamstrings']),
  strength('Dumbbell Hip Thrust', 'Glutes', 'Dumbbell', ['Hamstrings']),
  strength('Glute Bridge', 'Glutes', 'Bodyweight', ['Hamstrings']),
  strength('Cable Glute Kickback', 'Glutes', 'Cable', ['Hamstrings']),
  strength('Hip Abduction', 'Glutes', 'Machine'),
  strength('Sumo Deadlift', 'Glutes', 'Barbell', ['Hamstrings', 'Quads', 'Back']),

  strength('Standing Calf Raise', 'Calves', 'Machine'),
  strength('Seated Calf Raise', 'Calves', 'Machine'),
  strength('Leg Press Calf Raise', 'Calves', 'Machine'),
  strength('Single-Leg Calf Raise', 'Calves', 'Bodyweight'),

  strength('Wrist Curl', 'Forearms', 'Dumbbell'),
  strength('Reverse Wrist Curl', 'Forearms', 'Dumbbell'),
  strength('Farmer Carry', 'Forearms', 'Dumbbell', ['Shoulders', 'Back', 'Abs']),
  strength('Dead Hang', 'Forearms', 'Bodyweight', ['Back']),

  strength('Plank', 'Abs', 'Bodyweight', ['Shoulders']),
  strength('Side Plank', 'Abs', 'Bodyweight', ['Shoulders']),
  strength('Crunch', 'Abs', 'Bodyweight'),
  strength('Cable Crunch', 'Abs', 'Cable'),
  strength('Hanging Leg Raise', 'Abs', 'Bodyweight', ['Forearms']),
  strength('Reverse Crunch', 'Abs', 'Bodyweight'),
  strength('Ab Wheel Rollout', 'Abs', 'Other', ['Shoulders', 'Back']),
  strength('Dead Bug', 'Abs', 'Bodyweight'),
  strength('Russian Twist', 'Abs', 'Bodyweight'),
  strength('Pallof Press', 'Abs', 'Cable'),

  cardio('Treadmill Run', 'Machine'),
  cardio('Outdoor Run', 'Other'),
  cardio('Stationary Bike', 'Machine'),
  cardio('Rowing Machine', 'Machine'),
  cardio('Stair Climber', 'Machine'),
  cardio('Elliptical', 'Machine'),
  cardio('Jump Rope', 'Other'),
  cardio('Burpee', 'Bodyweight')
]

function catalogId(name: string): string {
  return `builtin:${name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)/g, '')}`
}

export function createBuiltinExercises(timestamp: string): Exercise[] {
  return builtinExerciseCatalog.map((exercise) => ({
    id: catalogId(exercise.name),
    ...exercise,
    isCustom: false,
    createdAt: timestamp,
    updatedAt: timestamp
  }))
}

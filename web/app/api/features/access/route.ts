import { NextResponse } from 'next/server'

type PlanTier = 'free' | 'member'

const FEATURE_ACCESS = {
  basic_simulation: 'free',
  lookthrough_top10: 'free',
  lookthrough_full: 'member',
  advanced_simulation: 'member',
  export_csv: 'member',
} as const satisfies Record<string, PlanTier>

export async function GET() {
  return NextResponse.json({
    data: {
      plan: 'free' as PlanTier,
      features: FEATURE_ACCESS,
    },
  })
}


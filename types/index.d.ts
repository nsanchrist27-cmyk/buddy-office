export type Mood = 'sleep' | 'type' | 'read' | 'run' | 'search' | 'joy' | 'oops' | 'ko'

export type Agent = {
  name: string
  look: number
  mood: Mood
  calls: number
  isDone: boolean
  doing: string
  kind: string
  startedAt: number
  // Desk index in the office (-1: no desk left), rest spot once done (-1: none yet).
  seat: number
  rest: number
  finishedAt: number
}

declare module 'claude-code' {
  interface PluginState {
    buddy: {
      mood: Mood
      doing: string
      startedAt: number
      agents: Record<string, Agent>
      records: Record<string, number>
    }
  }
}

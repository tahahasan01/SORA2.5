import type { SoraRequest, SoraResponse, DmaDimensionQuestions, DmaAssessRequest, DmaAssessResult, HealthResponse } from '../types'

const BASE = ''

async function post<T>(url: string, body: unknown): Promise<T> {
  const res = await fetch(BASE + url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

async function get<T>(url: string): Promise<T> {
  const res = await fetch(BASE + url)
  if (!res.ok) {
    const err = await res.json().catch(() => ({ detail: `HTTP ${res.status}` }))
    throw new Error(err.detail || `Request failed: ${res.status}`)
  }
  return res.json()
}

export const api = {
  health: async (): Promise<HealthResponse> => {
    const res = await fetch(BASE + '/health')
    if (!res.ok) throw new Error('API offline')
    return res.json()
  },
  soraCalculate: (data: SoraRequest) => post<SoraResponse>('/sora/calculate', data),
  dmaGetQuestions: () => get<DmaDimensionQuestions[]>('/dma/questions'),
  dmaAssess: (data: DmaAssessRequest) => post<DmaAssessResult>('/dma/assess', data),
  dmaGetResults: (id: string) => get<DmaAssessResult>(`/dma/results/${id}`),
}

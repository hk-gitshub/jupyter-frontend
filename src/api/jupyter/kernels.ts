import { restAPI } from './http'
import type { KernelModel } from './types'

export async function createKernel(name = 'python3'): Promise<KernelModel> {
  const res = await restAPI.post<KernelModel>('/api/kernels', { name })
  return res.data
}

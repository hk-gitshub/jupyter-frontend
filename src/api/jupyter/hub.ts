import { hubServerAPI } from './http'
import type { HubUserModel } from './types'

export async function hubGetCurrentUser(): Promise<HubUserModel> {
  const res = await hubServerAPI.get<HubUserModel>('/hub/api/user', {
    headers: { Accept: 'application/json' },
  })
  return res.data
}

export async function hubGetUserList(): Promise<HubUserModel> {
  const res = await hubServerAPI.get<HubUserModel>('/hub/api/users', {
    headers: { Accept: 'application/json' },
  })
  return res.data
}

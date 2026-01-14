import axios, { type AxiosInstance } from 'axios'

function env(name: string): string | undefined {
  // Vite exposes env vars on import.meta.env
  return (import.meta.env as Record<string, string | undefined>)[name]
}

export const JUPYTER_HUB_BASE_URL = env('VITE_JUPYTER_HUB_BASE_URL') ?? '/jupyter'
export const JUPYTER_SERVER_BASE_URL = env('VITE_JUPYTER_SERVER_BASE_URL') ?? '/jupyter'

const token = env('VITE_JUPYTER_TOKEN') ?? ''

// For JupyterHub cookie auth, credentials must be included.
const withCredentials = false

const authHeaders = token ? { Authorization: `token ${token}` } : undefined

export const hubServerAPI: AxiosInstance = axios.create({
  baseURL: JUPYTER_HUB_BASE_URL,
  withCredentials,
  headers: authHeaders,
})

export const restAPI: AxiosInstance = axios.create({
  baseURL: JUPYTER_SERVER_BASE_URL,
  withCredentials,
  headers: authHeaders,
})

/**
 * Helper to target a specific user server under the same Hub base URL.
 * Example: /jupyter + user=admin -> /jupyter/user/admin
 */
export function createUserrestAPI(username: string): AxiosInstance {
  const base = new URL(JUPYTER_HUB_BASE_URL.replace(/\/$/, '') + '/', window.location.origin)
  const userBase = new URL(`./user/${encodeURIComponent(username)}/`, base)
  return axios.create({
    baseURL: userBase.pathname.replace(/\/$/, ''),
    withCredentials,
    headers: authHeaders,
  })
}

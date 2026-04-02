import { create } from 'zustand'

export const useUploadStore = create((set, get) => ({
  uploads: [],       // all active/recent upload sessions
  apiBase: import.meta.env.VITE_API_BASE || '',
  token: localStorage.getItem('upload_token') || 'devkey-1',

  setToken: (t) => {
    localStorage.setItem('upload_token', t)
    set({ token: t })
  },

  addUpload: (upload) =>
    set((s) => ({ uploads: [upload, ...s.uploads] })),

  updateUpload: (id, patch) =>
    set((s) => ({
      uploads: s.uploads.map((u) => {
        if (u.uploadId !== id) return u
        const update = typeof patch === 'function' ? patch(u) : patch
        return { ...u, ...update }
      }),
    })),

  removeUpload: (id) =>
    set((s) => ({ uploads: s.uploads.filter((u) => u.uploadId !== id) })),

  getUpload: (id) => get().uploads.find((u) => u.uploadId === id),
}))

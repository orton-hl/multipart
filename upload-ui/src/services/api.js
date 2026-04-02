import axios from 'axios'

const PART_SIZE = 5 * 1024 * 1024 // 5 MB

function getHeaders(token) {
  if (token.startsWith('ey')) return { Authorization: `Bearer ${token}` }
  return { 'X-API-Key': token }
}

export async function initiateUpload({ file, partCount, encryption, partnerId, token, apiBase }) {
  const res = await axios.post(
    `${apiBase}/uploads`,
    {
      filename: file.name,
      content_type: file.type || 'application/octet-stream',
      file_size_bytes: file.size,
      part_count: partCount,
      encryption,
      metadata: { partner_id: partnerId, uploaded_by: 'ui-client' },
    },
    { headers: getHeaders(token) }
  )
  return res.data
}

export async function completeUpload({ uploadId, parts, token, apiBase }) {
  const res = await axios.post(
    `${apiBase}/uploads/complete`,
    { upload_id: uploadId, parts },
    { headers: getHeaders(token) }
  )
  return res.data
}

export async function abortUpload({ uploadId, token, apiBase }) {
  await axios.delete(`${apiBase}/uploads/${uploadId}`, { headers: getHeaders(token) })
}

export async function getUploadStatus({ uploadId, token, apiBase }) {
  const res = await axios.get(`${apiBase}/uploads/${uploadId}/status`, {
    headers: getHeaders(token),
  })
  return res.data
}

export async function refreshPartUrl({ uploadId, partNumber, token, apiBase }) {
  const res = await axios.get(
    `${apiBase}/uploads/${uploadId}/part/${partNumber}/refresh`,
    { headers: getHeaders(token) }
  )
  return res.data
}

// Upload a single part with retry
async function uploadPart({ url, chunk, partNumber, onProgress, signal, retries = 4 }) {
  const delays = [1000, 3000, 10000, 30000]
  for (let attempt = 0; attempt < retries; attempt++) {
    try {
      const res = await axios.put(url, chunk, {
        signal,
        headers: { 'Content-Type': 'application/octet-stream' },
        onUploadProgress: (e) => {
          if (e.total) onProgress(partNumber, e.loaded / e.total)
        },
      })
      const etag = res.headers['etag'] || res.headers['ETag'] || ''
      return { partNumber, etag: etag.replace(/"/g, '') }
    } catch (err) {
      if (axios.isCancel(err)) throw err
      if (attempt === retries - 1) throw err
      await new Promise((r) => setTimeout(r, delays[attempt]))
    }
  }
}

// Full multipart upload orchestrator
export async function runMultipartUpload({
  file,
  session,           // response from initiateUpload
  concurrency = 4,
  onPartProgress,    // (partNumber, fraction) => void
  onPartDone,        // (partNumber) => void
  signal,
}) {
  const { presignedUrls } = session
  const etags = []

  // Upload in batches of `concurrency`
  for (let i = 0; i < presignedUrls.length; i += concurrency) {
    const batch = presignedUrls.slice(i, i + concurrency)
    const results = await Promise.all(
      batch.map(({ partNumber, url }) => {
        const start = (partNumber - 1) * PART_SIZE
        const chunk = file.slice(start, start + PART_SIZE)
        return uploadPart({
          url, chunk, partNumber, signal,
          onProgress: onPartProgress,
        }).then((result) => { onPartDone(partNumber); return result })
      })
    )
    etags.push(...results)
  }

  return etags.sort((a, b) => a.partNumber - b.partNumber)
}

export function calcPartCount(fileSize, partSizeMB = 5) {
  return Math.max(1, Math.ceil(fileSize / (partSizeMB * 1024 * 1024)))
}

export function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024, sizes = ['B', 'KB', 'MB', 'GB', 'TB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return `${(bytes / Math.pow(k, i)).toFixed(1)} ${sizes[i]}`
}

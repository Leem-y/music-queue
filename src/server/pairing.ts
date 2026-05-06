type PairingState = {
  code: string
  expiresAtMs: number
}

const state: PairingState = {
  code: "000000",
  expiresAtMs: 0,
}

function randomCode() {
  // 6-digit numeric code (TV-friendly)
  return String(Math.floor(100000 + Math.random() * 900000))
}

export function getOrRotatePairingCode(ttlMs: number) {
  const now = Date.now()
  if (!state.expiresAtMs || now >= state.expiresAtMs) {
    state.code = randomCode()
    state.expiresAtMs = now + ttlMs
  }
  return { code: state.code, ttlMs: Math.max(0, state.expiresAtMs - now) }
}

export function isValidPairingCode(currentCode: string, input: string) {
  return String(input).trim() === currentCode
}


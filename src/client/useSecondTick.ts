"use client"

import { useEffect, useState } from "react"

export function useSecondTick() {
  const [, setT] = useState(0)
  useEffect(() => {
    const id = window.setInterval(() => setT((x) => x + 1), 1000)
    return () => window.clearInterval(id)
  }, [])
}


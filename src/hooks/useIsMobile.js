import { useEffect, useState } from 'react'

// true เมื่อจอแคบกว่า breakpoint `sm` ของ Tailwind (640px)
// ใช้กับค่าที่ต้องส่งเป็นตัวเลขให้ Recharts ซึ่งใช้คลาส Tailwind ไม่ได้
const QUERY = '(max-width: 639px)'

export default function useIsMobile() {
  const [isMobile, setIsMobile] = useState(() => window.matchMedia(QUERY).matches)
  useEffect(() => {
    const mql = window.matchMedia(QUERY)
    const onChange = (e) => setIsMobile(e.matches)
    mql.addEventListener('change', onChange)
    return () => mql.removeEventListener('change', onChange)
  }, [])
  return isMobile
}

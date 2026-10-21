"use client";

import { useEffect, useState } from "react";

/** True on phone-width screens (under Tailwind's sm breakpoint), for things sized in JS (slabs, pack art). */
export function usePhone() {
  const [phone, setPhone] = useState(false);
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 639px)");
    const on = () => setPhone(mq.matches);
    on();
    mq.addEventListener("change", on);
    return () => mq.removeEventListener("change", on);
  }, []);
  return phone;
}

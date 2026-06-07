import Link from "next/link";

export default function Sidebar() {
  return (
    <>
      <Link href="/admin/dashboard">Dashboard</Link>

      <Link href="/admin/deliveries">DSP Delivery</Link>

      <Link href="/admin/royalties">Royalties</Link>

      <Link href="/admin/analytics">Analytics</Link>
    </>
  );
}
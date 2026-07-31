import { redirect } from "next/navigation";

/** Root → login. Replace with a session check once auth lands (Dev-A). */
export default function Home() {
  redirect("/login");
}

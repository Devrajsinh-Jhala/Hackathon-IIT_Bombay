import ComplianceChecker from "@/components/ComplianceChecker";
import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <ComplianceChecker />
      </main>
    </>
  );
}

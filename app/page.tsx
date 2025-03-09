import ComplianceChecker from "@/components/ComplianceChecker";
import ComplianceDocumentGenerator from "@/components/DocumentGenerator";
import Navbar from "@/components/Navbar";

export default function Home() {
  return (
    <>
      <Navbar />
      <main>
        <ComplianceChecker />
        <ComplianceDocumentGenerator />
      </main>
    </>
  );
}

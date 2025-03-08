"use client";

import { useState, useEffect, useRef } from "react";
import Papa from "papaparse";
import { jsPDF } from "jspdf";
import autoTable from "jspdf-autotable";
import { useRouter } from "next/navigation";
import { createClient } from "@supabase/supabase-js";

// Interfaces
interface ShipmentData {
  item_name: string;
  item_id?: string;
  declared_value: number;
  weight: number;
  destination_country: string;
  commodity_code?: string;
  sender_name?: string;
  sender_address?: string;
  recipient_name?: string;
  recipient_address?: string;
}

interface ComplianceResult {
  status: "COMPLIANT" | "FLAGGED";
  shipment: ShipmentData;
  details: string;
  issues: {
    rule_name: string;
    description: string;
  }[];
  lastUpdated: string;
}

export default function ComplianceChecker() {
  // Client-side only rendering to prevent hydration mismatch
  const [isMounted, setIsMounted] = useState(false);

  useEffect(() => {
    setIsMounted(true);
  }, []);
  // Form fields
  const [itemName, setItemName] = useState<string>("");
  const [itemId, setItemId] = useState<string>("");
  const [declaredValue, setDeclaredValue] = useState<string>("");
  const [weight, setWeight] = useState<string>("");
  const [destinationCountry, setDestinationCountry] = useState<string>("");
  const [commodityCode, setCommodityCode] = useState<string>("");

  // State for results and loading
  const [results, setResults] = useState<ComplianceResult[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [csvData, setCsvData] = useState<ShipmentData[]>([]);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [generatingPdf, setGeneratingPdf] = useState<boolean>(false);

  const router = useRouter();

  // Initialize Supabase client with environment variables
  const supabase = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL || "",
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY || ""
  );

  // Set up real-time subscriptions to rule changes
  useEffect(() => {
    // Set up a subscription to the compliance_rules table
    const channel = supabase
      .channel("rule-changes")
      .on(
        "postgres_changes",
        {
          event: "*", // Listen to all events (INSERT, UPDATE, DELETE)
          schema: "public",
          table: "compliance_rules",
        },
        (payload) => {
          console.log("Rule change detected!", payload);
          // Force router refresh to update any data
          router.refresh();
        }
      )
      .subscribe();

    // Clean up on unmount
    return () => {
      supabase.removeChannel(channel);
    };
  }, [router, supabase]);

  // Force a refresh when component is mounted or focused
  useEffect(() => {
    // Refresh when the component mounts
    router.refresh();

    // Add event listener for when the window regains focus
    const handleFocus = () => {
      console.log("Window focused - refreshing data");
      router.refresh();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.removeEventListener("focus", handleFocus);
    };
  }, [router]);

  // Handle single shipment check
  const handleCheckCompliance = async (): Promise<void> => {
    if (!itemName || !declaredValue || !weight || !destinationCountry) {
      alert("Please fill out all required fields.");
      return;
    }

    setLoading(true);

    try {
      const shipmentData: ShipmentData = {
        item_name: itemName,
        item_id: itemId,
        declared_value: parseFloat(declaredValue),
        weight: parseFloat(weight),
        destination_country: destinationCountry,
        commodity_code: commodityCode || undefined,
      };

      // Get validation from backend API that checks against rules in Supabase
      const response = await fetch("/api/compliance/check", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shipment: shipmentData }),
      });

      if (!response.ok) {
        throw new Error("Failed to check compliance");
      }

      const result = await response.json();
      setResults([result]);
    } catch (error) {
      console.error("Error checking compliance:", error);
      alert("Failed to check compliance. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Handle CSV file upload
  const handleCsvUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    setLoading(true);

    Papa.parse(file, {
      header: true,
      complete: (results) => {
        try {
          const parsedData = results.data
            .filter((row: any) => row.item_name || row.name) // Filter out empty rows
            .map((row: any) => {
              // Clean currency values by removing $ and commas
              const declaredValueStr = (row.declared_value || row.value || "0")
                .toString()
                .replace(/[$,]/g, "");

              // Clean weight values by removing 'kg' and other units
              const weightStr = (row.weight || "0")
                .toString()
                .replace(/\s*kg\b|\s*lbs\b/gi, "")
                .trim();

              return {
                item_name: row.item_name || row.name || "",
                item_id: row.item_id || row.id || "",
                declared_value: parseFloat(declaredValueStr),
                weight: parseFloat(weightStr),
                destination_country:
                  row.destination_country || row.country || "",
                commodity_code: row.commodity_code || "",
                sender_name: row.sender_name || "",
                sender_address: row.sender_address || "",
                recipient_name: row.recipient_name || "",
                recipient_address: row.recipient_address || "",
              };
            }) as ShipmentData[];

          // Add debug logging
          console.log("Parsed CSV data:", parsedData);
          setCsvData(parsedData);
          setLoading(false);
        } catch (e) {
          console.error("Error parsing CSV:", e);
          alert("Error parsing CSV. Please check the format.");
          setLoading(false);
        }
      },
      error: (error) => {
        console.error("CSV parsing error:", error);
        alert("Error parsing CSV file");
        setLoading(false);
      },
    });
  };

  // Process all CSV data
  const processAllCsvData = async () => {
    if (!csvData.length) {
      alert("No CSV data to process");
      return;
    }

    setLoading(true);

    try {
      // Get validation from backend API that checks against rules in Supabase
      const response = await fetch("/api/compliance/check-bulk", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ shipments: csvData }),
      });

      if (!response.ok) {
        throw new Error("Failed to check compliance");
      }

      const results = await response.json();
      setResults(results);
    } catch (error) {
      console.error("Error processing CSV data:", error);
      alert("Failed to process shipments. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  // Clear CSV data
  const clearCsvData = () => {
    setCsvData([]);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  // Generate PDF report using jsPDF
  const generatePdfReport = (shipment: ShipmentData) => {
    try {
      setGeneratingPdf(true);

      // Create new PDF document
      const doc = new jsPDF();

      // Add title
      doc.setFontSize(20);
      doc.setTextColor(37, 99, 235); // Blue color
      doc.text("Shipping Compliance Report", 105, 20, { align: "center" });

      // Add compliance badge
      doc.setFillColor(16, 185, 129); // Green color
      doc.rect(14, 30, 30, 10, "F");
      doc.setTextColor(255, 255, 255);
      doc.setFontSize(12);
      doc.text("COMPLIANT", 29, 36, { align: "center" });

      // Add shipment details table
      autoTable(doc, {
        startY: 50,
        head: [["Field", "Value"]],
        body: [
          ["Item Name", shipment.item_name],
          ["Item ID", shipment.item_id || "N/A"],
          ["Declared Value", `$${shipment.declared_value.toFixed(2)}`],
          ["Weight", `${shipment.weight} kg`],
          ["Destination", shipment.destination_country],
          ["Commodity Code", shipment.commodity_code || "N/A"],
        ],
        theme: "grid",
        headStyles: { fillColor: [37, 99, 235], textColor: [255, 255, 255] },
        columnStyles: {
          0: { cellWidth: 40, fontStyle: "bold" },
          1: { cellWidth: 100 },
        },
      });

      // Add footer
      const finalY = (doc as any).lastAutoTable.finalY || 120;
      doc.setFontSize(10);
      doc.setTextColor(100, 100, 100);
      doc.text(
        `This compliance report was generated on ${new Date().toLocaleString()} and is valid for 24 hours.`,
        14,
        finalY + 20
      );

      // Save PDF
      doc.save(
        `compliance-report-${shipment.item_name
          .replace(/[^a-z0-9]/gi, "-")
          .toLowerCase()}.pdf`
      );
    } catch (error) {
      console.error("Error generating PDF:", error);
      alert("Failed to generate PDF. Please try again.");
    } finally {
      setGeneratingPdf(false);
    }
  };

  // Download all compliant reports as PDFs
  const downloadAllCompliantReports = () => {
    const compliantShipments = results
      .filter((r) => r.status === "COMPLIANT")
      .map((r) => r.shipment);

    if (compliantShipments.length === 0) {
      alert("No compliant shipments found.");
      return;
    }

    // Download each report with a slight delay to avoid browser issues
    setGeneratingPdf(true);
    compliantShipments.forEach((shipment, index) => {
      setTimeout(() => {
        generatePdfReport(shipment);
        if (index === compliantShipments.length - 1) {
          setGeneratingPdf(false);
        }
      }, index * 1000);
    });
  };
  // Prevent hydration errors by not rendering until client-side
  if (!isMounted) {
    return null; // Return null on server-side render
  }

  return (
    <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
      <div className="max-w-6xl mx-auto">
        <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
          {/* Header */}
          <div className="px-6 py-8 border-b border-gray-100 text-center">
            <h1 className="text-2xl font-semibold text-blue-700">
              Cross-Border Shipment Compliance Checker
            </h1>
            <p className="text-gray-500 mt-1">
              Verify compliance for international shipments
            </p>
          </div>

          {/* Tabs: Single Entry or CSV Upload */}
          <div className="px-6 py-4 border-b border-gray-100">
            <div className="flex space-x-4">
              <button
                className={`px-4 py-2 rounded-md ${
                  csvData.length === 0
                    ? "bg-blue-600 text-white"
                    : "text-gray-700"
                }`}
                onClick={clearCsvData}
              >
                Single Entry
              </button>
              <div className="relative">
                <input
                  type="file"
                  ref={fileInputRef}
                  accept=".csv"
                  onChange={handleCsvUpload}
                  className="absolute inset-0 opacity-0 w-full cursor-pointer"
                />
                <button
                  className={`px-4 py-2 rounded-md ${
                    csvData.length > 0
                      ? "bg-blue-600 text-white"
                      : "text-gray-700"
                  }`}
                >
                  CSV Upload
                </button>
              </div>
            </div>
          </div>

          {csvData.length > 0 ? (
            /* CSV Data Table */
            <div className="px-6 py-6">
              <h2 className="font-medium text-lg mb-4">
                Uploaded Shipments ({csvData.length})
              </h2>

              <div className="overflow-x-auto">
                <table className="min-w-full divide-y divide-gray-200">
                  <thead>
                    <tr>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Item Name
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        ID
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Value
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Weight
                      </th>
                      <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                        Destination
                      </th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-gray-200">
                    {csvData.slice(0, 5).map((shipment, index) => (
                      <tr key={index}>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {shipment.item_name}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {shipment.item_id || "N/A"}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          ${shipment.declared_value.toFixed(2)}
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {shipment.weight} kg
                        </td>
                        <td className="px-4 py-2 whitespace-nowrap">
                          {shipment.destination_country}
                        </td>
                      </tr>
                    ))}
                    {csvData.length > 5 && (
                      <tr>
                        <td
                          colSpan={5}
                          className="px-4 py-2 text-gray-500 text-sm"
                        >
                          ...and {csvData.length - 5} more shipments
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>

              <div className="mt-6 flex justify-end gap-4">
                <button
                  className="px-4 py-2 bg-gray-200 rounded-md"
                  onClick={clearCsvData}
                >
                  Clear
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-md"
                  onClick={processAllCsvData}
                  disabled={loading}
                >
                  {loading ? "Processing..." : "Check All Shipments"}
                </button>
              </div>
            </div>
          ) : (
            /* Single Entry Form */
            <div className="px-6 py-6">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Item Name *
                  </label>
                  <input
                    type="text"
                    value={itemName}
                    onChange={(e) => setItemName(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter item name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Item ID
                  </label>
                  <input
                    type="text"
                    value={itemId}
                    onChange={(e) => setItemId(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter item ID (optional)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Declared Value ($) *
                  </label>
                  <input
                    type="number"
                    value={declaredValue}
                    onChange={(e) => setDeclaredValue(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter declared value"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Weight (kg) *
                  </label>
                  <input
                    type="number"
                    value={weight}
                    onChange={(e) => setWeight(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter weight in kg"
                    min="0"
                    step="0.01"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Destination Country *
                  </label>
                  <input
                    type="text"
                    value={destinationCountry}
                    onChange={(e) => setDestinationCountry(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter country code (e.g., US, GB)"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Commodity Code
                  </label>
                  <input
                    type="text"
                    value={commodityCode}
                    onChange={(e) => setCommodityCode(e.target.value)}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter HS code (optional)"
                  />
                </div>
              </div>

              <div className="mt-6">
                <button
                  className={`w-full py-3.5 rounded-lg font-medium ${
                    loading
                      ? "bg-blue-400 cursor-not-allowed"
                      : "bg-blue-600 hover:bg-blue-700 text-white"
                  }`}
                  onClick={handleCheckCompliance}
                  disabled={loading}
                >
                  {loading ? "Checking..." : "Check Compliance"}
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Results Section */}
        {results.length > 0 && (
          <div className="bg-white rounded-xl shadow-md overflow-hidden">
            <div className="px-6 py-4 border-b border-gray-100 flex justify-between items-center">
              <h2 className="text-xl font-semibold text-blue-700">
                Compliance Results
              </h2>

              {results.filter((r) => r.status === "COMPLIANT").length > 0 && (
                <button
                  onClick={downloadAllCompliantReports}
                  disabled={generatingPdf}
                  className={`flex items-center px-3 py-2 rounded text-sm font-medium
                    ${
                      generatingPdf
                        ? "bg-gray-300 text-gray-600 cursor-not-allowed"
                        : "bg-blue-600 text-white hover:bg-blue-700"
                    }`}
                >
                  <svg
                    className="h-4 w-4 mr-1"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                    />
                  </svg>
                  {generatingPdf
                    ? "Generating PDFs..."
                    : "Download All Compliant Reports"}
                </button>
              )}
            </div>

            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Item
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Destination
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Value
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Issues
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Actions
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {results.map((result, index) => (
                    <tr
                      key={index}
                      className={result.status === "FLAGGED" ? "bg-red-50" : ""}
                    >
                      <td className="px-6 py-4 whitespace-nowrap">
                        <div className="font-medium">
                          {result.shipment.item_name}
                        </div>
                        <div className="text-sm text-gray-500">
                          {result.shipment.item_id || "No ID"}
                        </div>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span
                          className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full 
                          ${
                            result.status === "COMPLIANT"
                              ? "bg-green-100 text-green-800"
                              : "bg-red-100 text-red-800"
                          }`}
                        >
                          {result.status}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {result.shipment.destination_country}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        ${result.shipment.declared_value.toFixed(2)}
                      </td>
                      <td className="px-6 py-4">
                        {result.status === "FLAGGED" &&
                          result.issues.map((issue, i) => (
                            <div key={i} className="text-sm text-red-600 mb-1">
                              • {issue.rule_name}: {issue.description}
                            </div>
                          ))}
                        {result.status === "COMPLIANT" && (
                          <div className="text-sm text-green-600">
                            No issues found
                          </div>
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        {result.status === "COMPLIANT" && (
                          <button
                            onClick={() => generatePdfReport(result.shipment)}
                            disabled={generatingPdf}
                            className={`text-sm flex items-center ${
                              generatingPdf
                                ? "text-gray-400 cursor-not-allowed"
                                : "text-blue-600 hover:text-blue-900"
                            }`}
                          >
                            <svg
                              className="h-4 w-4 mr-1"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                strokeWidth={2}
                                d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"
                              />
                            </svg>
                            Generate PDF
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

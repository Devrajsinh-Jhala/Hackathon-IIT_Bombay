"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import Navbar from "@/components/Navbar";
import { useRouter } from "next/navigation";

// Define the types for our compliance rules
interface ComplianceRule {
  id: string;
  rule_name: string;
  rule_description: string;
  rule_type: "VALUE" | "WEIGHT" | "COUNTRY" | "ITEM" | "DOCUMENTATION";
  rule_conditions: any;
  is_active: boolean;
  created_at?: string;
}

export default function AdminPage() {
  const router = useRouter();

  // Authentication state
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [adminEmail, setAdminEmail] = useState("");
  const [adminPassword, setAdminPassword] = useState("");
  const [loginError, setLoginError] = useState<string | null>(null);

  // State for existing rules
  const [rules, setRules] = useState<ComplianceRule[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // State for creating new rule
  const [newRule, setNewRule] = useState<Partial<ComplianceRule>>({
    rule_name: "",
    rule_description: "",
    rule_type: "VALUE",
    rule_conditions: {},
    is_active: true,
  });

  // Value conditions for different rule types
  const [valueThreshold, setValueThreshold] = useState<string>("1000");
  const [weightThreshold, setWeightThreshold] = useState<string>("20");
  const [countryCode, setCountryCode] = useState<string>("");
  const [itemName, setItemName] = useState<string>("");
  const [docType, setDocType] = useState<string>("");

  // Check for an existing session on mount
  useEffect(() => {
    async function checkSession() {
      const {
        data: { session },
      } = await supabase.auth.getSession();
      // Verify that the session exists and the user is the admin
      if (
        session &&
        session.user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL
      ) {
        setIsAuthenticated(true);
        fetchRules();
      } else {
        setIsAuthenticated(false);
      }
    }
    checkSession();
  }, []);

  // Function to handle admin login
  const handleLogin = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setLoginError(null);
    try {
      const { data, error } = await supabase.auth.signInWithPassword({
        email: adminEmail,
        password: adminPassword,
      });
      if (error) {
        setLoginError(error.message);
        return;
      }
      // Check that the logged in user is the admin
      if (
        data.session &&
        data.session.user.email === process.env.NEXT_PUBLIC_ADMIN_EMAIL
      ) {
        setIsAuthenticated(true);
        fetchRules();
      } else {
        setLoginError("Unauthorized: Not an admin user.");
        await supabase.auth.signOut();
      }
    } catch (err: any) {
      console.error("Login error:", err);
      setLoginError("Login failed. Please try again.");
    }
  };

  // Function to fetch rules from Supabase
  async function fetchRules() {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from("compliance_rules")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setRules(data || []);
    } catch (err) {
      console.error("Error fetching rules:", err);
      setError("Failed to load compliance rules");
    } finally {
      setLoading(false);
    }
  }

  // Function to toggle a rule's active status
  const toggleRuleStatus = async (id: string, currentStatus: boolean) => {
    try {
      setLoading(true);
      const { error } = await supabase
        .from("compliance_rules")
        .update({ is_active: !currentStatus })
        .eq("id", id);

      if (error) throw error;

      // Update the UI without refetching
      setRules(
        rules.map((rule) =>
          rule.id === id ? { ...rule, is_active: !currentStatus } : rule
        )
      );
    } catch (err) {
      console.error("Error updating rule status:", err);
      setError("Failed to update rule status");
    } finally {
      setLoading(false);
    }
  };

  // Function to handle creating a new rule
  const handleCreateRule = async () => {
    try {
      if (!newRule.rule_name || !newRule.rule_description) {
        setError("Rule name and description are required");
        return;
      }

      // Create the rule conditions based on the rule type
      let ruleConditions = {};
      switch (newRule.rule_type) {
        case "VALUE":
          const valueLimit = parseFloat(valueThreshold);
          if (isNaN(valueLimit)) {
            setError("Value threshold must be a valid number");
            return;
          }
          ruleConditions = {
            threshold: valueLimit,
            currency: "USD",
            documentation_required: [
              "commercial_invoice",
              "customs_declaration",
            ],
          };
          break;
        case "WEIGHT":
          const weightLimit = parseFloat(weightThreshold);
          if (isNaN(weightLimit)) {
            setError("Weight threshold must be a valid number");
            return;
          }
          ruleConditions = {
            max_weight: weightLimit,
            unit: "kg",
            carrier_restrictions: weightLimit > 30,
          };
          break;
        case "COUNTRY":
          if (!countryCode) {
            setError("Country code is required");
            return;
          }
          ruleConditions = {
            country_code: countryCode,
            restriction_level: "HIGH",
            requires_license: true,
          };
          break;
        case "ITEM":
          if (!itemName) {
            setError("Item name is required");
            return;
          }
          ruleConditions = {
            item_name: itemName,
            restriction_level: "HIGH",
            category: "RESTRICTED",
          };
          break;
        case "DOCUMENTATION":
          if (!docType) {
            setError("Document type is required");
            return;
          }
          ruleConditions = {
            document_type: docType,
            required_for: ["international_shipping", "high_value_items"],
          };
          break;
      }

      // Create the new rule in Supabase
      const { data, error } = await supabase
        .from("compliance_rules")
        .insert({
          rule_name: newRule.rule_name,
          rule_description: newRule.rule_description,
          rule_type: newRule.rule_type,
          rule_conditions: ruleConditions,
          is_active: true,
        })
        .select();

      if (error) throw error;

      // Add the new rule to the list and reset the form
      if (data && data.length > 0) {
        setRules([data[0], ...rules]);
        resetForm();
      }
    } catch (err) {
      console.error("Error creating rule:", err);
      setError("Failed to create compliance rule");
    }
  };

  // Reset the form after submission
  const resetForm = () => {
    setNewRule({
      rule_name: "",
      rule_description: "",
      rule_type: "VALUE",
      rule_conditions: {},
      is_active: true,
    });
    setValueThreshold("1000");
    setWeightThreshold("20");
    setCountryCode("");
    setItemName("");
    setDocType("");
    setError(null);
  };

  // Handle form field changes
  const handleInputChange = (
    e: React.ChangeEvent<
      HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement
    >
  ) => {
    const { name, value } = e.target;
    setNewRule((prev) => ({ ...prev, [name]: value }));
  };

  // Function to delete a rule
  const handleDeleteRule = async (id: string) => {
    if (!confirm("Are you sure you want to delete this rule?")) return;

    try {
      setLoading(true);
      const { error } = await supabase
        .from("compliance_rules")
        .delete()
        .eq("id", id);

      if (error) throw error;

      // Remove the rule from the UI
      setRules(rules.filter((rule) => rule.id !== id));
    } catch (err) {
      console.error("Error deleting rule:", err);
      setError("Failed to delete rule");
    } finally {
      setLoading(false);
    }
  };

  // If not authenticated, render the login form
  if (!isAuthenticated) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 p-4">
        <div className="bg-white p-8 rounded shadow-md w-full max-w-md">
          <h2 className="text-xl font-semibold mb-4">Admin Login</h2>
          {loginError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
              {loginError}
            </div>
          )}
          <form onSubmit={handleLogin}>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Admin Email
              </label>
              <input
                type="email"
                value={adminEmail}
                onChange={(e) => setAdminEmail(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-200"
                required
              />
            </div>
            <div className="mb-4">
              <label className="block text-sm font-medium text-gray-600 mb-2">
                Password
              </label>
              <input
                type="password"
                value={adminPassword}
                onChange={(e) => setAdminPassword(e.target.value)}
                className="w-full px-4 py-3 rounded-lg border border-gray-200"
                required
              />
            </div>
            <button
              type="submit"
              className="w-full px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              Login
            </button>
          </form>
        </div>
      </div>
    );
  }

  // If authenticated, render the admin panel
  return (
    <>
      <Navbar />
      <div className="min-h-screen bg-gray-50 p-4 sm:p-6 md:p-8">
        <div className="max-w-6xl mx-auto">
          <div className="bg-white rounded-xl shadow-md overflow-hidden mb-8">
            {/* Header */}
            <div className="px-6 py-8 border-b border-gray-100">
              <h1 className="text-2xl font-semibold text-blue-700">
                Compliance Rules Administration
              </h1>
              <p className="text-gray-500 mt-1">
                Manage compliance rules for cross-border shipments
              </p>
            </div>

            {/* Create New Rule Form */}
            <div className="px-6 py-6 border-b border-gray-100">
              <h2 className="text-lg font-medium text-gray-800 mb-4">
                Create New Compliance Rule
              </h2>

              {error && (
                <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded mb-4">
                  {error}
                </div>
              )}

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Rule Name *
                  </label>
                  <input
                    type="text"
                    name="rule_name"
                    value={newRule.rule_name}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Enter rule name"
                  />
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Rule Type *
                  </label>
                  <select
                    name="rule_type"
                    value={newRule.rule_type}
                    onChange={handleInputChange}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                  >
                    <option value="VALUE">Declared Value Threshold</option>
                    <option value="WEIGHT">Weight Restriction</option>
                    <option value="COUNTRY">Restricted Country</option>
                    <option value="ITEM">Restricted Item</option>
                    <option value="DOCUMENTATION">
                      Documentation Requirement
                    </option>
                  </select>
                </div>

                <div className="md:col-span-2">
                  <label className="block text-sm font-medium text-gray-600 mb-2">
                    Rule Description *
                  </label>
                  <textarea
                    name="rule_description"
                    value={newRule.rule_description}
                    onChange={handleInputChange}
                    rows={3}
                    className="w-full px-4 py-3 rounded-lg border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="Describe the rule and its purpose"
                  ></textarea>
                </div>

                {/* Conditional fields based on rule type */}
                <div className="md:col-span-2">
                  <h3 className="text-sm font-medium text-gray-700 mb-2">
                    Rule Conditions
                  </h3>

                  {newRule.rule_type === "VALUE" && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">
                        Value exceeds $
                      </label>
                      <input
                        type="number"
                        value={valueThreshold}
                        onChange={(e) => setValueThreshold(e.target.value)}
                        className="w-32 px-3 py-2 border border-gray-200 rounded"
                        min="0"
                        step="0.01"
                      />
                      <span className="text-sm text-gray-500">
                        USD (requires additional documentation)
                      </span>
                    </div>
                  )}

                  {newRule.rule_type === "WEIGHT" && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">
                        Weight exceeds
                      </label>
                      <input
                        type="number"
                        value={weightThreshold}
                        onChange={(e) => setWeightThreshold(e.target.value)}
                        className="w-24 px-3 py-2 border border-gray-200 rounded"
                        min="0"
                        step="0.1"
                      />
                      <span className="text-sm text-gray-500">
                        kg (may require special handling)
                      </span>
                    </div>
                  )}

                  {newRule.rule_type === "COUNTRY" && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">
                        Country Code:
                      </label>
                      <input
                        type="text"
                        value={countryCode}
                        onChange={(e) =>
                          setCountryCode(e.target.value.toUpperCase())
                        }
                        className="w-24 px-3 py-2 border border-gray-200 rounded"
                        placeholder="US"
                        maxLength={2}
                      />
                      <span className="text-sm text-gray-500">
                        2-letter ISO country code (e.g., US, CN, RU)
                      </span>
                    </div>
                  )}

                  {newRule.rule_type === "ITEM" && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">
                        Item Name:
                      </label>
                      <input
                        type="text"
                        value={itemName}
                        onChange={(e) => setItemName(e.target.value)}
                        className="w-64 px-3 py-2 border border-gray-200 rounded"
                        placeholder="e.g., Lithium Batteries"
                      />
                    </div>
                  )}

                  {newRule.rule_type === "DOCUMENTATION" && (
                    <div className="flex items-center gap-2">
                      <label className="text-sm text-gray-600">
                        Document Type:
                      </label>
                      <input
                        type="text"
                        value={docType}
                        onChange={(e) => setDocType(e.target.value)}
                        className="w-64 px-3 py-2 border border-gray-200 rounded"
                        placeholder="e.g., Import License"
                      />
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-6 flex justify-end gap-3">
                <button
                  className="px-4 py-2 bg-gray-200 rounded-md"
                  onClick={resetForm}
                >
                  Cancel
                </button>
                <button
                  className="px-4 py-2 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                  onClick={handleCreateRule}
                >
                  Create Rule
                </button>
              </div>
            </div>

            {/* Existing Rules Table */}
            <div className="px-6 py-6">
              <h2 className="text-lg font-medium text-gray-800 mb-4">
                Existing Rules
              </h2>

              {loading && <p className="text-gray-500">Loading rules...</p>}

              {!loading && rules.length === 0 && (
                <p className="text-gray-500">No compliance rules found.</p>
              )}

              {rules.length > 0 && (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Rule Name
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Type
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Description
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Status
                        </th>
                        <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                          Actions
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {rules.map((rule) => (
                        <tr key={rule.id}>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <div className="font-medium text-gray-900">
                              {rule.rule_name}
                            </div>
                            <div className="text-xs text-gray-500">
                              Created:{" "}
                              {new Date(
                                rule.created_at || ""
                              ).toLocaleDateString()}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span className="px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-800">
                              {rule.rule_type}
                            </span>
                          </td>
                          <td className="px-6 py-4">
                            <div className="text-sm text-gray-900">
                              {rule.rule_description}
                            </div>
                            <div className="text-xs text-gray-500 mt-1">
                              {rule.rule_type === "VALUE" && (
                                <>
                                  Threshold: ${rule.rule_conditions.threshold}{" "}
                                  {rule.rule_conditions.currency}
                                </>
                              )}
                              {rule.rule_type === "WEIGHT" && (
                                <>
                                  Max: {rule.rule_conditions.max_weight}{" "}
                                  {rule.rule_conditions.unit}
                                </>
                              )}
                              {rule.rule_type === "COUNTRY" && (
                                <>
                                  Country: {rule.rule_conditions.country_code}
                                </>
                              )}
                              {rule.rule_type === "ITEM" && (
                                <>Item: {rule.rule_conditions.item_name}</>
                              )}
                            </div>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap">
                            <span
                              className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${
                                rule.is_active
                                  ? "bg-green-100 text-green-800"
                                  : "bg-gray-100 text-gray-800"
                              }`}
                            >
                              {rule.is_active ? "Active" : "Inactive"}
                            </span>
                          </td>
                          <td className="px-6 py-4 whitespace-nowrap text-sm">
                            <div className="flex space-x-3">
                              <button
                                onClick={() =>
                                  toggleRuleStatus(rule.id, rule.is_active)
                                }
                                className={`${
                                  rule.is_active
                                    ? "text-amber-600 hover:text-amber-900"
                                    : "text-green-600 hover:text-green-900"
                                }`}
                              >
                                {rule.is_active ? "Deactivate" : "Activate"}
                              </button>
                              <button
                                onClick={() => handleDeleteRule(rule.id)}
                                className="text-red-600 hover:text-red-900"
                              >
                                Delete
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

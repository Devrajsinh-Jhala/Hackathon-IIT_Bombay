// components/ComplianceDocumentGenerator.tsx
"use client";
import React, { useState } from "react";
import { Form, Select, Input, Button, Alert, Card, Tag, Spin } from "antd";
import { PlusOutlined } from "@ant-design/icons";

export default function ComplianceDocumentGenerator() {
  const [form] = Form.useForm();
  const [loading, setLoading] = useState(false);
  const [document, setDocument] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [appliedRestrictions, setAppliedRestrictions] = useState<any[]>([]);

  const documentTypes = [
    { label: "Certificate of Origin", value: "certificate-of-origin" },
    { label: "Commercial Invoice", value: "commercial-invoice" },
    { label: "Export Declaration", value: "export-declaration" },
  ];

  const handleSubmit = async (values: any) => {
    setLoading(true);
    setError(null);
    setDocument(null);

    try {
      const response = await fetch("/api/documentation/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(values),
      });

      const data = await response.json();

      if (!data.success) {
        setError(data.error || "Failed to generate document");
        return;
      }

      setDocument(data.document);
      setAppliedRestrictions(data.restrictions || []);
    } catch (err) {
      setError("An error occurred while generating the document");
    } finally {
      setLoading(false);
    }
  };

  return (
    <Card
      title="Compliance Document Generator"
      style={{ maxWidth: 900, margin: "0 auto" }}
    >
      <Form form={form} layout="vertical" onFinish={handleSubmit}>
        <Form.Item
          name="documentType"
          label="Document Type"
          rules={[{ required: true, message: "Please select document type" }]}
        >
          <Select options={documentTypes} />
        </Form.Item>

        <Form.List name="products">
          {(fields: any, { add, remove }: any) => (
            <>
              {fields.map((field: any, index: any) => (
                <Form.Item
                  required={false}
                  label={index === 0 ? "Products" : ""}
                  key={field.key}
                >
                  <Form.Item
                    {...field}
                    validateTrigger={["onChange", "onBlur"]}
                    rules={[
                      {
                        required: true,
                        message:
                          "Please enter product name or delete this field",
                      },
                    ]}
                    noStyle
                  >
                    <Input
                      placeholder="Product name"
                      style={{ width: "90%" }}
                    />
                  </Form.Item>
                  {fields.length > 1 ? (
                    <Button
                      danger
                      onClick={() => remove(field.name)}
                      style={{ marginLeft: 10 }}
                    >
                      Remove
                    </Button>
                  ) : null}
                </Form.Item>
              ))}
              <Form.Item>
                <Button
                  type="dashed"
                  onClick={() => add()}
                  icon={<PlusOutlined />}
                  style={{ width: "100%" }}
                >
                  Add Product
                </Button>
              </Form.Item>
            </>
          )}
        </Form.List>

        <div style={{ display: "flex", gap: 16 }}>
          <Form.Item
            name="fromCountry"
            label="From Country"
            rules={[{ required: true, message: "Please enter origin country" }]}
            style={{ flex: 1 }}
          >
            <Input placeholder="e.g. United States" />
          </Form.Item>

          <Form.Item
            name="toCountry"
            label="To Country"
            rules={[
              { required: true, message: "Please enter destination country" },
            ]}
            style={{ flex: 1 }}
          >
            <Input placeholder="e.g. Japan" />
          </Form.Item>
        </div>

        <Form.Item label="Shipment Details">
          <Card size="small">
            <Form.Item
              name={["shipmentDetails", "reference"]}
              label="Reference Number"
            >
              <Input placeholder="e.g. SHP-12345" />
            </Form.Item>

            <div style={{ display: "flex", gap: 16 }}>
              <Form.Item
                name={["shipmentDetails", "value"]}
                label="Value"
                style={{ flex: 1 }}
              >
                <Input placeholder="e.g. 5000" />
              </Form.Item>

              <Form.Item
                name={["shipmentDetails", "currency"]}
                label="Currency"
                style={{ flex: 1 }}
              >
                <Input placeholder="e.g. USD" />
              </Form.Item>
            </div>
          </Card>
        </Form.Item>

        <Form.Item label="Company Details">
          <Card size="small">
            <Form.Item name={["companyDetails", "name"]} label="Company Name">
              <Input placeholder="e.g. Acme Corporation" />
            </Form.Item>

            <Form.Item
              name={["companyDetails", "exporterId"]}
              label="Exporter ID"
            >
              <Input placeholder="e.g. EXP123456789" />
            </Form.Item>
          </Card>
        </Form.Item>

        <Form.Item>
          <Button
            type="primary"
            htmlType="submit"
            loading={loading}
            style={{ width: "100%" }}
          >
            Generate Compliance Document
          </Button>
        </Form.Item>
      </Form>

      {error && (
        <Alert type="error" message={error} style={{ marginTop: 16 }} />
      )}

      {loading && (
        <Spin
          tip="Generating document..."
          style={{ display: "block", margin: "20px auto" }}
        />
      )}

      {document && (
        <Card title="Generated Document" style={{ marginTop: 16 }}>
          {appliedRestrictions.length > 0 && (
            <div style={{ marginBottom: 16 }}>
              <strong>Applied Restrictions:</strong>
              <br />
              {appliedRestrictions.map((restriction, i) => (
                <Tag
                  color={
                    restriction.severity === "PROHIBITED" ? "red" : "orange"
                  }
                  key={i}
                  style={{ margin: 4 }}
                >
                  {restriction.item_name}
                </Tag>
              ))}
            </div>
          )}

          <div
            dangerouslySetInnerHTML={{ __html: document }}
            style={{ border: "1px solid #eee", padding: 16 }}
          />

          <div style={{ marginTop: 16, textAlign: "right" }}>
            <Button
              onClick={() => {
                const blob = new Blob([document], { type: "text/html" });
                const url = URL.createObjectURL(blob);
                // @ts-ignore
                const a = document.createElement("a");
                a.href = url;
                a.download = "compliance_document.html";
                a.click();
                URL.revokeObjectURL(url);
              }}
            >
              Download HTML
            </Button>
            <Button
              style={{ marginLeft: 8 }}
              type="primary"
              onClick={() => {
                const printWindow = window.open("", "_blank");
                if (printWindow) {
                  printWindow.document.write(document);
                  printWindow.document.close();
                  printWindow.print();
                }
              }}
            >
              Print Document
            </Button>
          </div>
        </Card>
      )}
    </Card>
  );
}

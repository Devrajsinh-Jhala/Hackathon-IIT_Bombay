// app/api/documentation/generate/route.ts
import { NextRequest, NextResponse } from 'next/server';
import { supabase } from '@/lib/supabase';
import { GoogleGenerativeAI } from "@google/generative-ai";

// Reuse the existing Gemini API configuration
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY || '');
const model = genAI.getGenerativeModel({ model: "gemini-1.5-pro" });

export async function POST(request: NextRequest) {
    try {
        const {
            products,
            fromCountry,
            toCountry,
            documentType,
            shipmentDetails = {},
            companyDetails = {}
        } = await request.json();

        // Validate required fields
        if (!products || !Array.isArray(products) || !fromCountry || !toCountry || !documentType) {
            return NextResponse.json({
                success: false,
                error: "Missing required fields"
            }, { status: 400 });
        }

        // Check for restrictions on these products
        const restrictions = await getApplicableRestrictions(products, fromCountry, toCountry);

        // Get document template based on document type
        const documentTemplate = await getDocumentTemplate(documentType);
        if (!documentTemplate) {
            return NextResponse.json({
                success: false,
                error: "Unsupported document type"
            }, { status: 400 });
        }

        // Generate the compliance document using AI
        const document = await generateComplianceDocument(
            documentTemplate,
            products,
            restrictions,
            fromCountry,
            toCountry,
            shipmentDetails,
            companyDetails
        );

        // Log the document generation for audit purposes
        await supabase.from('compliance_documents').insert([{
            document_type: documentType,
            products: products,
            from_country: fromCountry,
            to_country: toCountry,
            restrictions_applied: restrictions.map(r => r.id),
            document_content: document,
            generated_at: new Date().toISOString()
        }]);

        return NextResponse.json({
            success: true,
            document,
            restrictions: restrictions.map(r => ({
                id: r.id,
                item_name: r.item_name,
                severity: r.severity,
                requirements: r.requirements
            })),
            documentType,
            disclaimer: "This document is AI-generated. Review by a compliance officer is recommended."
        });
    } catch (error) {
        console.error("Error generating compliance document:", error);
        return NextResponse.json({
            success: false,
            error: error instanceof Error ? error.message : "Unknown error"
        }, { status: 500 });
    }
}

async function getApplicableRestrictions(products: string[], fromCountry: string, toCountry: string) {
    // First, check for exact matches
    const { data: exactMatches } = await supabase
        .from('restricted_items')
        .select('*')
        .in('item_name', products);

    // Next, look for potential matches using pattern matching for each product
    const patternMatchPromises = products.map(product =>
        supabase
            .from('restricted_items')
            .select('*')
            .ilike('item_name', `%${product}%`)
    );

    const patternResults = await Promise.all(patternMatchPromises);

    // Combine all results and remove duplicates
    const allMatches = [
        ...(exactMatches || []),
        ...patternResults.flatMap(result => result.data || [])
    ];

    // Remove duplicates by ID
    const uniqueRestrictions = Array.from(
        new Map(allMatches.map(item => [item.id, item])).values()
    );

    // Filter for country relevance by checking description
    return uniqueRestrictions.filter(restriction => {
        const description = restriction.description.toLowerCase();
        // If the restriction mentions the destination country
        return description.includes(toCountry.toLowerCase());
    });
}

async function getDocumentTemplate(documentType: string) {
    const templates = {
        "certificate-of-origin": {
            title: "Certificate of Origin",
            sections: [
                "exporter_details",
                "importer_details",
                "product_details",
                "origin_declaration",
                "applicable_restrictions",
                "certification"
            ],
            requiredFields: [
                "products", "fromCountry", "toCountry",
                "shipmentDetails.reference", "companyDetails.name"
            ]
        },
        "commercial-invoice": {
            title: "Commercial Invoice",
            sections: [
                "seller_details",
                "buyer_details",
                "invoice_details",
                "product_listing",
                "trade_restriction_declarations",
                "terms_and_conditions"
            ],
            requiredFields: [
                "products", "fromCountry", "toCountry",
                "shipmentDetails.value", "shipmentDetails.currency"
            ]
        },
        "export-declaration": {
            title: "Export Declaration",
            sections: [
                "exporter_information",
                "export_control_classification",
                "shipment_details",
                "product_description",
                "compliance_statements",
                "authorization"
            ],
            requiredFields: [
                "products", "fromCountry", "toCountry",
                "companyDetails.exporterId"
            ]
        }
    };

    return templates[documentType as keyof typeof templates];
}

async function generateComplianceDocument(
    template: any,
    products: string[],
    restrictions: any[],
    fromCountry: string,
    toCountry: string,
    shipmentDetails: any,
    companyDetails: any
) {
    const promptContent = `
    Generate a formal ${template.title} document based on the following information:

    PRODUCTS:
    ${products.map((p, i) => `${i + 1}. ${p}`).join('\n')}

    TRADE ROUTE:
    From: ${fromCountry}
    To: ${toCountry}

    APPLICABLE RESTRICTIONS:
    ${restrictions.length > 0
            ? restrictions.map(r => `- ${r.item_name}: ${r.severity}, ${r.requirements || 'No specific requirements'}`).join('\n')
            : 'No specific restrictions identified.'}

    SHIPMENT DETAILS:
    ${Object.entries(shipmentDetails).map(([k, v]) => `${k}: ${v}`).join('\n')}

    COMPANY DETAILS:
    ${Object.entries(companyDetails).map(([k, v]) => `${k}: ${v}`).join('\n')}

    DOCUMENT SECTIONS:
    ${template.sections.join('\n')}

    Please create a properly formatted, legally-accurate ${template.title} that includes appropriate language for all identified trade restrictions. Document should be formatted in HTML with proper semantic elements.

    Create a professional, legally-appropriate document that would satisfy customs requirements. Include appropriate legal disclaimers, certifications, and declarations based on the trade restrictions identified.
  `;

    try {
        const result = await model.generateContent(promptContent);
        const documentContent = result.response.text();

        return documentContent.replace(/```html|```/g, '').trim();
    } catch (error) {
        console.error("Error generating document with AI:", error);
        throw new Error("Failed to generate compliance document");
    }
}
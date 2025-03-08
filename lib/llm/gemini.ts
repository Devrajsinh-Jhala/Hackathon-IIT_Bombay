// import { GoogleGenerativeAI } from '@google/generative-ai';

// const apiKey = process.env.GEMINI_API_KEY || '';
// const genAI = new GoogleGenerativeAI(apiKey);

// export async function analyzeComplianceWithGemini(
//     itemName: string,
//     quickCheck: string,
//     searchResults: string
// ): Promise<any> {
//     try {
//         const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

//         const prompt = `
//     Analyze this item for import/export compliance: "${itemName}"
    
//     Quick check results: ${quickCheck}
    
//     Search results: ${searchResults}
    
//     Based on the above information, determine if this item has any compliance issues.
//     Return ONLY valid JSON with this format:
//     {
//       "status": "COMPLIANT" or "NON-COMPLIANT" or "WARNING",
//       "item": "${itemName}",
//       "details": "clear explanation of compliance status",
//       "metadata": {
//         "regionRestrictions": ["region1", "region2"], // empty array if none
//         "documentationComplete": boolean,
//         "weightCompliant": boolean
//       }
//     }`;

//         const result = await model.generateContent(prompt);
//         const text = result.response.text();

//         try {
//             return JSON.parse(text);
//         } catch (e) {
//             // If parsing fails, extract JSON using regex
//             const jsonMatch = text.match(/\{[\s\S]*\}/);
//             return jsonMatch ? JSON.parse(jsonMatch[0]) : createDefaultResponse(itemName);
//         }
//     } catch (error) {
//         console.error('Gemini error:', error);
//         return createDefaultResponse(itemName);
//     }
// }

// function createDefaultResponse(itemName: string) {
//     return {
//         status: "WARNING",
//         item: itemName,
//         details: "Could not determine compliance status due to technical issues.",
//         metadata: {
//             regionRestrictions: [],
//             documentationComplete: true,
//             weightCompliant: true
//         }
//     };
// }


// new

// lib/llm/gemini.ts - Update to handle trade restrictions
import { GoogleGenerativeAI } from '@google/generative-ai';

const apiKey = process.env.GEMINI_API_KEY || '';
const genAI = new GoogleGenerativeAI(apiKey);

export async function analyzeComplianceWithGemini(
    itemName: string,
    quickCheck: string,
    searchResults: string
): Promise<any> {
    try {
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-pro' });

        const prompt = `
    You are a trade compliance specialist verifying news about tariffs, sanctions, or trade barriers.
    
    Analyze this product for import/export compliance: "${itemName}"
    
    Quick check results: ${quickCheck}
    
    Search results: ${searchResults}
    
    Based on the above information, determine if this product has CONFIRMED import/export restrictions.
    Be conservative - only confirm restrictions if they are definitely real and in effect or announced.
    
    Return ONLY valid JSON with this format:
    {
      "status": "COMPLIANT" or "NON-COMPLIANT" or "WARNING",
      "item": "${itemName}",
      "details": "clear explanation of compliance status with specific trade restrictions",
      "metadata": {
        "regionRestrictions": ["country1", "country2"], 
        "regulationType": "tariff/ban/quota/etc.",
        "tariffRate": "percentage or flat rate if applicable",
        "effectiveDate": "when restriction takes effect",
        "confidence": "percentage between 0-100 representing confidence in this assessment"
      }
    }`;

        const result = await model.generateContent(prompt);
        const text = result.response.text();

        try {
            return JSON.parse(text);
        } catch (e) {
            // If parsing fails, extract JSON using regex
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            return jsonMatch ? JSON.parse(jsonMatch[0]) : createDefaultResponse(itemName);
        }
    } catch (error) {
        console.error('Gemini error:', error);
        return createDefaultResponse(itemName);
    }
}

function createDefaultResponse(itemName: string) {
    return {
        status: "WARNING",
        item: itemName,
        details: "Could not verify trade restriction details due to technical issues.",
        metadata: {
            regionRestrictions: [],
            regulationType: "unknown",
            confidence: 50
        }
    };
}
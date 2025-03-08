// import { ChatOllama } from '@langchain/ollama';
// import { StringOutputParser } from '@langchain/core/output_parsers';
// import { RunnableSequence } from '@langchain/core/runnables';
// import { ChatPromptTemplate } from '@langchain/core/prompts';

// const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

// export const ollamaModel = new ChatOllama({
//     baseUrl: OLLAMA_BASE_URL,
//     model: 'llama3',
//     temperature: 0.5,
// });

// export async function quickComplianceCheck(itemName: string): Promise<string> {
//     const promptTemplate = ChatPromptTemplate.fromMessages([
//         ['system', `You are a compliance officer examining import/export regulations. 
//     Assess if this item might be restricted in any major jurisdiction. 
//     Return JSON: {"potentialIssue": boolean, "reason": "brief reason if issue exists"}`],
//         ['human', `Check compliance for: {itemName}`]
//     ]);

//     const chain = RunnableSequence.from([
//         promptTemplate,
//         ollamaModel,
//         new StringOutputParser(),
//     ]);

//     try {
//         return await chain.invoke({ itemName });
//     } catch (error) {
//         console.error('Ollama error:', error);
//         return JSON.stringify({ potentialIssue: false, reason: "Error checking compliance" });
//     }
// }


// new

// lib/llm/ollama.ts - Update for trade restrictions
import { ChatOllama } from '@langchain/ollama';
import { StringOutputParser } from '@langchain/core/output_parsers';
import { RunnableSequence } from '@langchain/core/runnables';
import { ChatPromptTemplate } from '@langchain/core/prompts';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL || 'http://localhost:11434';

export const ollamaModel = new ChatOllama({
    baseUrl: OLLAMA_BASE_URL,
    model: 'llama3',
    temperature: 0.5,
});

export async function quickComplianceCheck(itemName: string): Promise<string> {
    const promptTemplate = ChatPromptTemplate.fromMessages([
        ['system', `You are a trade compliance officer examining import/export regulations. 
    Assess if this product might be subject to tariffs, sanctions, or restrictions in major jurisdictions. 
    Return JSON: {"potentialIssue": boolean, "reason": "brief reason if issue exists", "possibleRestrictions": ["tariff", "sanction", "ban"]}`],
        ['human', `Check trade restrictions for product: ${itemName}`]
    ]);

    const chain = RunnableSequence.from([
        promptTemplate,
        ollamaModel,
        new StringOutputParser(),
    ]);

    try {
        return await chain.invoke({ itemName });
    } catch (error) {
        console.error('Ollama error:', error);
        return JSON.stringify({ 
            potentialIssue: true, 
            reason: "Error checking compliance, assuming potential issue"
        });
    }
}
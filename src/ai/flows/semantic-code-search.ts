'use server';
/**
 * @fileOverview A Genkit flow for performing semantic code search within a project.
 *
 * - semanticCodeSearch - A function that handles the semantic code search process.
 * - SemanticCodeSearchInput - The input type for the semanticCodeSearch function.
 * - SemanticCodeSearchOutput - The return type for the semanticCodeSearch function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const SemanticCodeSearchInputSchema = z.object({
  query: z.string().describe('The natural language query for semantic code search.'),
});
export type SemanticCodeSearchInput = z.infer<typeof SemanticCodeSearchInputSchema>;

const SemanticCodeSearchOutputSchema = z.object({
  results: z.array(z.object({
    filePath: z.string().describe('The path to the file containing the code snippet.'),
    codeSnippet: z.string().describe('The relevant code section found.'),
    explanation: z.string().optional().describe('An explanation of why this code snippet is relevant.'),
  })).describe('A list of relevant code sections found based on the semantic search query.'),
});
export type SemanticCodeSearchOutput = z.infer<typeof SemanticCodeSearchOutputSchema>;

// Mock tool for semantic code search
// In a real application, this would interface with a project indexing and search service.
const codeSearchTool = ai.defineTool(
  {
    name: 'codeSearch',
    description: 'Performs a semantic search across the indexed codebase to find relevant code sections based on a natural language query.',
    inputSchema: z.object({
      query: z.string().describe('The natural language query for semantic code search.'),
    }),
    outputSchema: z.array(z.object({
      filePath: z.string().describe('The path to the file containing the code snippet.'),
      codeSnippet: z.string().describe('The relevant code section found.'),
    })).describe('A list of relevant code sections.'),
  },
  async (input) => {
    console.log(`Performing semantic code search for query: "${input.query}"`);
    // This is a mock implementation. In a real scenario, this would query an actual index.
    if (input.query.toLowerCase().includes('user authentication')) {
      return [
        {
          filePath: 'src/services/authService.ts',
          codeSnippet: `
            // Authenticates a user with email and password
            async function signIn(email, password) {
              // ... actual authentication logic ...
              return { userId: '123', token: 'abc' };
            }

            // Checks if a user is authenticated
            function isAuthenticated(token) {
              // ... token validation logic ...
              return true;
            }
          `,
        },
        {
          filePath: 'src/routes/userRoutes.ts',
          codeSnippet: `
            // Route for user login
            router.post('/login', async (req, res) => {
              const { email, password } = req.body;
              try {
                const user = await authService.signIn(email, password);
                res.json(user);
              } catch (error) {
                res.status(401).send('Authentication failed');
              }
            });
          `,
        },
      ];
    } else if (input.query.toLowerCase().includes('database connection')) {
      return [
        {
          filePath: 'src/config/database.ts',
          codeSnippet: `
            import { Sequelize } from 'sequelize';

            const sequelize = new Sequelize('database', 'username', 'password', {
              host: 'localhost',
              dialect: 'mysql'
            });

            async function connectDB() {
              try {
                await sequelize.authenticate();
                console.log('Connection to database has been established successfully.');
              } catch (error) {
                console.error('Unable to connect to the database:', error);
              }
            }

            export { sequelize, connectDB };
          `,
        },
      ];
    } else {
      return [
        {
          filePath: 'src/utils/helpers.ts',
          codeSnippet: `
            // Generic helper function to format dates
            function formatDate(date) {
              return new Date(date).toLocaleDateString();
            }

            // Generic helper function to capitalize strings
            function capitalize(str) {
              return str.charAt(0).toUpperCase() + str.slice(1);
            }
          `,
        },
      ];
    }
  }
);


const semanticCodeSearchPrompt = ai.definePrompt({
  name: 'semanticCodeSearchPrompt',
  input: {schema: SemanticCodeSearchInputSchema},
  output: {schema: SemanticCodeSearchOutputSchema},
  tools: [codeSearchTool],
  prompt: `You are an AI assistant specialized in understanding and navigating codebases.
The user wants to find relevant code sections based on a natural language query.
Your task is to use the 'codeSearch' tool to semantically search the project and then present the findings.

Instructions:
1. Use the 'codeSearch' tool with the user's query to retrieve relevant code snippets.
2. For each code snippet returned by the tool, provide the 'filePath' and the 'codeSnippet' itself.
3. Optionally, add a brief 'explanation' for each snippet describing its relevance to the original query.

User Query: "{{{query}}}"

Output the results in the specified JSON format.`,
});


export async function semanticCodeSearch(input: SemanticCodeSearchInput): Promise<SemanticCodeSearchOutput> {
  return semanticCodeSearchFlow(input);
}

const semanticCodeSearchFlow = ai.defineFlow(
  {
    name: 'semanticCodeSearchFlow',
    inputSchema: SemanticCodeSearchInputSchema,
    outputSchema: SemanticCodeSearchOutputSchema,
  },
  async (input) => {
    const {output} = await semanticCodeSearchPrompt(input);
    return output!;
  }
);

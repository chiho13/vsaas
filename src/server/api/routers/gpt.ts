import { z } from "zod";
import { createTRPCRouter, protectedProcedure } from "@/server/api/trpc";
import { TRPCError } from "@trpc/server";
import { Configuration, OpenAIApi } from "openai";

const configuration = new Configuration({
  apiKey: process.env.OPENAI_API_KEY,
});
const openai = new OpenAIApi(configuration);

export const GPTRouter = createTRPCRouter({
  getEquation: protectedProcedure
    .input(
      z.object({
        equationName: z.string(),
      })
    )
    .query(async ({ input }) => {
      const { equationName } = input;
      try {
        const completion = await openai.createChatCompletion({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "user",
              content: `You are a text to katex api.
            Please return the JSON object containing the KaTeX code and explanation for '${equationName}', search for the concept relating to physics,
             chemistry, mathematics, economics, finance. The JSON format should be {"result": "katex code", "alt": "accessible text of equation for screen readers", "note": "explanation"}. 
             Preserve the single backslashes in the KaTeX code by using double backslashes in string.
             Do not include any $ signs in the KaTeX code. 
             Double check sources for accuracy. 
             Be flexible with the input phrasing and recognize concepts even if they are slightly differently written.
              If you don't recognize the input, return the json object {"error": "Input not recognised"}.
             You must only give the JSON object in the response so it can be parsed.
              `,
            },
          ],
          max_tokens: 500,
          temperature: 0.2,
        });

        const data = completion.data.choices[0].message.content;
        return data;
      } catch (err) {
        console.error(err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error",
        });
      }
    }),
  katextotext: protectedProcedure
    .input(
      z.object({
        katex: z.string(),
      })
    )
    .query(async ({ input }) => {
      const { katex } = input;
      try {
        const completion = await openai.createChatCompletion({
          model: "gpt-3.5-turbo",
          messages: [
            {
              role: "user",
              content: `Please return a stringified JSON object containing the accessible natural language description of the KaTeX code: "${katex}" in the format {"result": "text"}.
              If you don't recognise the katex code return {"error": "Input not recognised"}.
              `,
            },
          ],
          max_tokens: 500,
          temperature: 0.7,
        });

        const data = completion.data.choices[0].message.content;
        return data;
      } catch (err) {
        console.error(err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error",
        });
      }
    }),

  mathQuestions: protectedProcedure
    .input(
      z.object({
        mathQuestions: z.string(),
      })
    )
    .query(async ({ input }) => {
      const { mathQuestions } = input;
      try {
        const completion = await openai.createChatCompletion({
          model: "gpt-4",
          messages: [
            {
              role: "user",
              content: `
              Generate a JSON object for Questions based on the following input:
    ${mathQuestions}

      Each question should have a paragraph element containing the question text and an equation element with the related equation. The output should be an array of objects with the following structure:

[
{
"id": "16 random character string",
"type": "paragraph",
"children": [{"text": "question"}]
},
{
"id": "16 random character string",
"type": "equation",
"latex": "KaTeX code",
"children": [{"text": ""}]
}
]
              `,
            },
          ],
          max_tokens: 2000,
          temperature: 0.7,
        });

        const data = completion.data.choices[0].message.content;
        return data;
      } catch (err) {
        console.error(err);
        throw new TRPCError({
          code: "INTERNAL_SERVER_ERROR",
          message: "Internal server error",
        });
      }
    }),
});

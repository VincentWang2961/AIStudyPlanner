# AI Planner Debug Module

This module provides a temporary AI planning flow that can run before full frontend and database integration.

## Endpoint

`POST /api/ai/debug-generate-plan`
`GET /api/ai/debug-status`

Request body:

```json
{
  "programCode": "62510",
  "userMessage": "I am an IT student interested in AI and machine learning."
}
```

The endpoint returns a JSON study plan and a short rationale in British English.

`debug-status` returns runtime diagnostics such as whether an API key is configured.

## Browser Console Test

```js
fetch('http://localhost:3001/api/ai/debug-generate-plan', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    programCode: '62510',
    userMessage: 'I am an IT student interested in AI and machine learning. I want a balanced workload.',
  }),
})
  .then((response) => response.json())
  .then((data) => console.log(data));
```

## Environment Variables

- `OPENAI_API_KEY` (required): OpenAI API key.
- `OPENAI_MODEL` (optional): defaults to `gpt-5.5`. GPT-5.5 is the API id for the Fast GPT-5.5 model.
- `OPENAI_REASONING_EFFORT` (optional): defaults to `low` for faster generation.
- `OPENAI_MAX_OUTPUT_TOKENS` (optional): defaults to `32000`.
- `AI_PLANNER_DEBUG_DUMP` (optional): defaults to `false`; set to `true` to write last prompt/response files to `/tmp`.

The service retries once if the model response is not valid JSON or does not match the expected shape.

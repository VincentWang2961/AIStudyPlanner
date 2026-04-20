# AI Planner Debug Module

This module provides a temporary AI planning flow that can run before full frontend and database integration.

## Endpoint

`POST /api/ai/debug-generate-plan`

Request body:

```json
{
  "programCode": "62510",
  "userMessage": "I am an IT student interested in AI and machine learning."
}
```

The endpoint returns a JSON study plan and a short rationale in British English.

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
- `OPENAI_MODEL` (optional): defaults to `gpt-5.3`.

The service retries once if the model response is not valid JSON or does not match the expected shape.

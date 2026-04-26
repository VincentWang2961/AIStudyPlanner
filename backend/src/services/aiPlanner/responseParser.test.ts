import { extractJsonFromModelOutput } from './responseParser';

describe('extractJsonFromModelOutput', () => {
  it('should return raw JSON when the input is already pure JSON', () => {
    const json = '{"foo": "bar"}';
    expect(extractJsonFromModelOutput(json)).toBe(json);
  });

  it('should extract JSON from a fenced code block', () => {
    const raw = 'Here is the answer:\n```json\n{"foo": "bar"}\n```\nThanks!';
    expect(extractJsonFromModelOutput(raw)).toBe('{"foo": "bar"}');
  });

  it('should extract the first JSON block from text with prefix and suffix', () => {
    const raw = 'Answer:<br>{"foo": "bar"} Extra text';
    expect(extractJsonFromModelOutput(raw)).toBe('{"foo": "bar"}');
  });

  it('should return the original string when no JSON braces are found', () => {
    const raw = 'No JSON content here.';
    expect(extractJsonFromModelOutput(raw)).toBe(raw);
  });
});

import { XMLParser, XMLBuilder } from 'fast-xml-parser';
import { validateQueryStructure, validateResponseStructure } from '../../main/services/xml-validator.js';

describe('XML Schema Contract - Query Format', () => {
  let parser: XMLParser;

  beforeEach(() => {
    parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: true,
      trimValues: true
    });
  });

  test('should parse valid query XML', () => {
    const xml = `
      <llmQuery>
        <userMessage>How much for college?</userMessage>
        <context topicId="test-topic" messageCount="5">
          <activeSubjects>education</activeSubjects>
          <recentKeywords>college, tuition</recentKeywords>
        </context>
      </llmQuery>
    `;

    const parsed = parser.parse(xml);
    expect(parsed.llmQuery).toBeDefined();
    expect(parsed.llmQuery.userMessage).toBe('How much for college?');
    expect(parsed.llmQuery.context.topicId).toBe('test-topic');
    expect(parsed.llmQuery.context.messageCount).toBe(5);
  });

  test('should reject query without userMessage', () => {
    const xml = `
      <llmQuery>
        <context topicId="test" messageCount="0" />
      </llmQuery>
    `;

    expect(() => {
      const parsed = parser.parse(xml);
      validateQueryStructure(parsed); // To be implemented
    }).toThrow('Missing required element: userMessage');
  });

  test('should handle XML special characters', () => {
    const xml = `
      <llmQuery>
        <userMessage>Test &lt;angle&gt; &amp; &quot;quotes&quot;</userMessage>
        <context topicId="test" messageCount="1" />
      </llmQuery>
    `;

    const parsed = parser.parse(xml);
    expect(parsed.llmQuery.userMessage).toBe('Test <angle> & "quotes"');
  });
});

describe('XML Schema Contract - Response Format', () => {
  let parser: XMLParser;

  beforeEach(() => {
    parser = new XMLParser({
      ignoreAttributes: false,
      attributeNamePrefix: '',
      parseAttributeValue: true,
      trimValues: true
    });
  });

  test('should parse valid response XML', () => {
    const xml = `
      <llmResponse>
        <response>529 plans are great for college savings.</response>
        <analysis>
          <subject name="college-savings" description="Saving for education" isNew="true">
            <keyword term="529-plan" confidence="0.95" />
            <keyword term="education" confidence="0.85" />
          </subject>
          <summaryUpdate>User asked about college savings.</summaryUpdate>
        </analysis>
      </llmResponse>
    `;

    const parsed = parser.parse(xml);
    expect(parsed.llmResponse.response).toBeDefined();
    expect(parsed.llmResponse.analysis.subject.name).toBe('college-savings');
    expect(parsed.llmResponse.analysis.subject.isNew).toBe('true');
  });

  test('should reject response without required elements', () => {
    const xml = `<llmResponse><response>Text only</response></llmResponse>`;

    expect(() => {
      const parsed = parser.parse(xml);
      validateResponseStructure(parsed); // To be implemented
    }).toThrow('Missing required element: analysis');
  });

  test('should reject invalid confidence values', () => {
    const xml = `
      <llmResponse>
        <response>Test</response>
        <analysis>
          <subject name="test" description="test" isNew="true">
            <keyword term="test" confidence="1.5" />
          </subject>
          <summaryUpdate>Test</summaryUpdate>
        </analysis>
      </llmResponse>
    `;

    expect(() => {
      const parsed = parser.parse(xml);
      validateResponseStructure(parsed); // To be implemented
    }).toThrow('Confidence must be between 0.0 and 1.0');
  });

  test('should handle multiple subjects', () => {
    const xml = `
      <llmResponse>
        <response>Multiple topics discussed.</response>
        <analysis>
          <subject name="topic-1" description="First" isNew="true">
            <keyword term="keyword1" confidence="0.9" />
          </subject>
          <subject name="topic-2" description="Second" isNew="false">
            <keyword term="keyword2" confidence="0.8" />
          </subject>
          <summaryUpdate>Discussion covered two topics.</summaryUpdate>
        </analysis>
      </llmResponse>
    `;

    const parsed = parser.parse(xml);
    const subjects = Array.isArray(parsed.llmResponse.analysis.subject)
      ? parsed.llmResponse.analysis.subject
      : [parsed.llmResponse.analysis.subject];
    expect(subjects).toHaveLength(2);
  });
});

// Validation functions imported from main/services/xml-validator.ts

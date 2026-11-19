// In the browser the built-in XML parser is used; @xmldom/xmldom is only needed for tests in Node.
export const DOMParser = globalThis.DOMParser;

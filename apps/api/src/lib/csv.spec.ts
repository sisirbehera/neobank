import { paiseToDecimal, toCsv } from './csv';

describe('toCsv', () => {
  it('quotes commas, quotes and newlines', () => {
    expect(toCsv([['a,b', 'say "hi"', 'two\nlines']])).toBe(
      '"a,b","say ""hi""","two\nlines"\r\n',
    );
  });

  it('neutralises spreadsheet formulas in text', () => {
    expect(toCsv([['=HYPERLINK("x")', '+1', '-2', '@SUM(A1)']])).toBe(
      `"'=HYPERLINK(""x"")",'+1,'-2,'@SUM(A1)\r\n`,
    );
  });

  it('writes numbers untouched', () => {
    expect(toCsv([[paiseToDecimal(-125075), paiseToDecimal(5)]])).toBe(
      '-1250.75,0.05\r\n',
    );
  });
});

declare module "next/font/google" {
  export interface FontOptions {
    subsets?: string[];
    weight?: string | string[];
    display?: string;
  }
  export function Inter(options?: FontOptions): {
    className: string;
    style: { fontFamily: string };
  };
}

declare module "next/server" {
  export class NextRequest {
    headers: Headers;
    url: string;
    nextUrl: {
      pathname: string;
      searchParams: URLSearchParams;
    };
    constructor(input: any, init?: any);
  }

  export class NextResponse extends Response {
    static next(): NextResponse;
    static redirect(url: string | URL): NextResponse;
  }
}

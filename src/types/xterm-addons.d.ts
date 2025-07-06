/**
 * Type definitions for xterm.js addons
 * These are unofficial types for @xterm addons that don't have built-in types
 */

declare module '@xterm/addon-fit' {
  import { Terminal, ITerminalAddon } from '@xterm/xterm';

  export class FitAddon implements ITerminalAddon {
    constructor();
    activate(terminal: Terminal): void;
    dispose(): void;
    fit(): void;
    proposeDimensions(): { cols: number; rows: number } | undefined;
  }
}

declare module '@xterm/addon-webgl' {
  import { Terminal, ITerminalAddon } from '@xterm/xterm';

  export class WebglAddon implements ITerminalAddon {
    constructor();
    activate(terminal: Terminal): void;
    dispose(): void;
    get isTextureAtlasBuilding(): boolean;
  }
}

declare module '@xterm/addon-search' {
  import { Terminal, ITerminalAddon } from '@xterm/xterm';

  export interface ISearchOptions {
    regex?: boolean;
    wholeWord?: boolean;
    caseSensitive?: boolean;
    incremental?: boolean;
  }

  export class SearchAddon implements ITerminalAddon {
    constructor();
    activate(terminal: Terminal): void;
    dispose(): void;
    findNext(term: string, searchOptions?: ISearchOptions): boolean;
    findPrevious(term: string, searchOptions?: ISearchOptions): boolean;
  }
}

declare module '@xterm/addon-serialize' {
  import { Terminal, ITerminalAddon } from '@xterm/xterm';

  export class SerializeAddon implements ITerminalAddon {
    constructor();
    activate(terminal: Terminal): void;
    dispose(): void;
    serialize(options?: { excludeAltBuffer?: boolean; excludeModes?: boolean }): string;
  }
}

declare module '@xterm/addon-unicode11' {
  import { Terminal, ITerminalAddon } from '@xterm/xterm';

  export class Unicode11Addon implements ITerminalAddon {
    constructor();
    activate(terminal: Terminal): void;
    dispose(): void;
  }
}

declare module '@xterm/addon-clipboard' {
  import { Terminal, ITerminalAddon } from '@xterm/xterm';

  export class ClipboardAddon implements ITerminalAddon {
    constructor();
    activate(terminal: Terminal): void;
    dispose(): void;
  }
}

declare module '@xterm/addon-web-links' {
  import { Terminal, ITerminalAddon } from '@xterm/xterm';

  export interface IWebLinkProviderOptions {
    hover?: boolean;
    urlRegex?: RegExp;
  }

  export class WebLinksAddon implements ITerminalAddon {
    constructor(handler?: (event: MouseEvent, uri: string) => void, options?: IWebLinkProviderOptions);
    activate(terminal: Terminal): void;
    dispose(): void;
  }
}
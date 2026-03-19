// Types for parsed CODESYS .fbsproj data

/** File classification from scanner */
export interface ScannedFile {
  path: string;
  type: 'gvl' | 'fb' | 'prg' | 'act' | 'meth' | 'fn' | 'unknown';
  /** Parent FB name for .meth.st / .act.st files */
  parentFb?: string;
}

/** Sections extracted from an ST file */
export interface StFileSections {
  metadata: string;
  declaration: string;
  implementation: string;
}

/** A variable declared in a GVL */
export interface ParsedVariable {
  name: string;
  dataType: string;
  gvlName: string;
  /** Hardware address from comment, e.g. "D03_B7.1" */
  hwAddress?: string;
  /** IO direction from comment: DI, DO, AI, AO */
  ioDirection?: string;
  comment?: string;
}

/** An FB instance declared in a GVL */
export interface ParsedFbInstance {
  name: string;
  fbTypeName: string;
  gvlName: string;
  comment?: string;
}

/** An FB definition parsed from .fb.st files */
export interface ParsedFbDefinition {
  name: string;
  extendsName?: string;
  sourceFile: string;
  parameters: ParsedFbParameter[];
}

/** A parameter of an FB definition */
export interface ParsedFbParameter {
  name: string;
  direction: string; // VAR_INPUT, VAR_OUTPUT, VAR_IN_OUT, VAR
  dataType: string;
}

/** A connection (wiring) between an FB instance and a variable */
export interface ParsedConnection {
  /** Fully qualified FB instance ref, e.g. "GVL_Alarms.Alarm001_..." */
  fbInstanceRef: string;
  /** Parameter name on the FB, e.g. "Input" */
  parameterName: string;
  /** Direction: INPUT (:=) or OUTPUT (=>) */
  direction: 'INPUT' | 'OUTPUT';
  /** Fully qualified variable ref, e.g. "GVL_Physical.SomeSignal" */
  variableRef: string;
  /** Raw expression as-is from source */
  rawExpression: string;
  sourceFile: string;
}

/** Result of GVL parsing */
export interface GvlParseResult {
  gvlName: string;
  variables: ParsedVariable[];
  fbInstances: ParsedFbInstance[];
}

/** Complete parse result for storage */
export interface FbsprojParseResult {
  sourcePath: string;
  gvlResults: GvlParseResult[];
  fbDefinitions: ParsedFbDefinition[];
  connections: ParsedConnection[];
}

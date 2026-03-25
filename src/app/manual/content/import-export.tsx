export function ImportExportSection() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <h1>Import &amp; Export</h1>
      <p className="lead text-muted-foreground">
        MIAS-IO supports importing signal data from external sources and exporting
        project configurations for use in other tools. This section covers the
        available import/export workflows.
      </p>

      <h2>Signal Import from Excel/CSV</h2>
      <p>
        The most common way to bootstrap a project is importing an existing IO list
        from a spreadsheet. MIAS-IO provides a structured import flow with column
        mapping to handle varying spreadsheet formats.
      </p>

      <h3>Import Workflow</h3>
      <ol>
        <li><strong>Upload file</strong> &mdash; Select an Excel (.xlsx) or CSV file containing your signal list.</li>
        <li><strong>Select sheet</strong> &mdash; For Excel files with multiple sheets, choose which sheet contains the IO data.</li>
        <li><strong>Map columns</strong> &mdash; Map your spreadsheet columns to MIAS-IO signal fields. The importer attempts auto-detection based on column headers.</li>
        <li><strong>Preview</strong> &mdash; Review the parsed data before importing. The preview highlights any validation issues (missing required fields, invalid values).</li>
        <li><strong>Import</strong> &mdash; Create the signals in the project database.</li>
      </ol>

      <h3>Supported Column Mappings</h3>
      <table>
        <thead>
          <tr>
            <th>MIAS-IO Field</th>
            <th>Common Column Names</th>
            <th>Notes</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Tag</td>
            <td>Tag, Signal Tag, Tag Name</td>
            <td>Required. Must be unique within the project.</td>
          </tr>
          <tr>
            <td>Description</td>
            <td>Description, Signal Description, Comment</td>
            <td>Recommended for documentation.</td>
          </tr>
          <tr>
            <td>Signal Type</td>
            <td>Type, Signal Type, IO Type</td>
            <td>Must resolve to DISCRETE or ANALOG.</td>
          </tr>
          <tr>
            <td>Direction</td>
            <td>Direction, I/O, Input/Output</td>
            <td>Must resolve to INPUT or OUTPUT.</td>
          </tr>
          <tr>
            <td>IO Type</td>
            <td>IO Type, Module Type, Card Type</td>
            <td>DI, DO, AI, or AO.</td>
          </tr>
          <tr>
            <td>System</td>
            <td>System, Subsystem, Area</td>
            <td>Mapped to SignalSystem records.</td>
          </tr>
          <tr>
            <td>Engineering Unit</td>
            <td>Unit, EU, Engineering Unit</td>
            <td>Matched against the global EngineeringUnit catalog.</td>
          </tr>
          <tr>
            <td>Scale Min / Max</td>
            <td>Scale Min, Scale Max, Range Low, Range High</td>
            <td>For analog signals only.</td>
          </tr>
          <tr>
            <td>Drawing Reference</td>
            <td>Drawing, Sheet, Drawing Ref</td>
            <td>Reference to electrical drawing.</td>
          </tr>
          <tr>
            <td>Cabinet</td>
            <td>Cabinet, Panel, Rack</td>
            <td>Hardware identifier: cabinet number.</td>
          </tr>
        </tbody>
      </table>

      <h2>MPV Import</h2>
      <p>
        The MPV (Marine Project Variables) import is a specialized import format that
        parses structured hardware identifiers from signal tags. This is used when
        importing from systems that encode the hardware location directly in the
        signal name.
      </p>
      <p>
        The MPV importer extracts hardware identifiers following the
        pattern <code>N&#123;cabinet&#125;:D&#123;carrier&#125;:&#123;subgroup&#125;&#123;typeCode&#125;&#123;instance&#125;</code>
        from signal tags or dedicated columns, and uses them to:
      </p>
      <ul>
        <li>Automatically create or match carriers and IO cards.</li>
        <li>Bind signals to the correct hardware channel.</li>
        <li>Populate the stable hardware identifier fields on the signal.</li>
      </ul>

      <h2>Export Formats</h2>
      <p>
        MIAS-IO supports several export formats for different use cases:
      </p>

      <h3>Signal List Export</h3>
      <p>
        Export the complete signal list as an Excel spreadsheet. This export includes
        all signal properties, hardware bindings, alarm configurations, and component
        associations. Useful for:
      </p>
      <ul>
        <li>Sending signal lists to external partners or classification societies.</li>
        <li>Generating documentation for project deliverables.</li>
        <li>Archiving project state at a specific revision.</li>
      </ul>

      <h3>CODESYS Export</h3>
      <p>
        The primary export path is via the CODESYS REST API, consumed by the CODESYS
        plugin. See the <strong>CODESYS Integration</strong> section for details. This
        generates GVL declarations, hardware configurations, and IO mappings directly
        in the CODESYS IDE.
      </p>

      <h2>Best Practices for Import Data</h2>
      <p>
        To ensure a smooth import process, follow these guidelines when preparing
        your source data:
      </p>

      <h3>General</h3>
      <ul>
        <li><strong>Use consistent naming</strong> &mdash; Signal tags should follow a consistent naming convention (e.g., System_Component_Function).</li>
        <li><strong>One signal per row</strong> &mdash; Each row in the spreadsheet should represent exactly one signal.</li>
        <li><strong>No merged cells</strong> &mdash; Merged cells in Excel cause parsing errors. Unmerge all cells before importing.</li>
        <li><strong>Clean headers</strong> &mdash; Use clear, single-row column headers. Avoid multi-row headers or blank header rows.</li>
      </ul>

      <h3>Signal Types</h3>
      <ul>
        <li>Use standard abbreviations: DI, DO, AI, AO (or the full names: Digital Input, Digital Output, Analog Input, Analog Output).</li>
        <li>If your spreadsheet uses a combined type/direction column (e.g., &quot;4-20mA Input&quot;), map it to the IO Type field and the importer will infer signal type and direction.</li>
      </ul>

      <h3>Analog Values</h3>
      <ul>
        <li>Ensure scale min/max values are numeric (not text like &quot;0-100&deg;C&quot;).</li>
        <li>Separate the unit from the value: put &quot;100&quot; in Scale Max and &quot;&deg;C&quot; in the Engineering Unit column.</li>
        <li>Use decimal points (not commas) for fractional values.</li>
      </ul>

      <h3>Hardware References</h3>
      <ul>
        <li>If your spreadsheet includes hardware identifiers, ensure they follow the N:D:XX format consistently.</li>
        <li>Cabinet and carrier numbers should be plain integers (not prefixed with &quot;N&quot; or &quot;D&quot; in the data column &mdash; the importer handles prefix parsing).</li>
      </ul>

      <h2>Import Error Handling</h2>
      <p>
        When the importer encounters issues, it categorizes them into:
      </p>
      <ul>
        <li><strong>Errors</strong> &mdash; Rows that cannot be imported (e.g., missing required tag, invalid signal type). These are skipped and reported.</li>
        <li><strong>Warnings</strong> &mdash; Rows that can be imported but have potential issues (e.g., unrecognized engineering unit, duplicate tags). These are imported but flagged for review.</li>
      </ul>
      <p>
        After import, review the import summary to address any flagged issues. You can
        edit imported signals individually in the signals table to correct any
        problems.
      </p>
    </article>
  );
}

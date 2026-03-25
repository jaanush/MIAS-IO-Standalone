export function OverviewSection() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <h1>Overview</h1>
      <p className="lead text-muted-foreground">
        MIAS-IO is a PLC I/O Configuration Editor designed for marine and industrial
        automation projects. It provides a structured workflow for managing PLC hardware
        setups, IO configurations, signal definitions, and code generation for CODESYS
        automation systems.
      </p>

      <h2>What is MIAS-IO?</h2>
      <p>
        MIAS-IO replaces spreadsheet-based PLC I/O lists with a database-driven web
        application. It tracks every signal from its physical wiring terminal through to
        the CODESYS variable that the PLC program reads, ensuring consistency between
        electrical drawings, hardware configuration, and control software.
      </p>
      <p>
        The system is built around a project-centric model: all hardware, signals,
        component templates, and network definitions belong to a project. Multiple
        engineers can work on the same project simultaneously, with role-based access
        controlling who can view or edit data.
      </p>

      <h2>Core Workflow</h2>
      <p>
        A typical project follows four main phases. Each phase builds on the previous
        one, though you can return to any phase at any time to refine your configuration.
      </p>

      {/* Workflow diagram */}
      <div className="my-8 flex justify-center">
        <svg viewBox="0 0 700 160" className="w-full max-w-2xl" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="ov-arrow" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 3.5 L 0 7 z" className="fill-foreground" />
            </marker>
          </defs>

          {/* Step 1 */}
          <rect x="5" y="30" width="140" height="70" rx="8" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="75" y="55" textAnchor="middle" className="fill-foreground font-medium" fontSize="12">1. Create</text>
          <text x="75" y="72" textAnchor="middle" className="fill-foreground font-medium" fontSize="12">Project</text>
          <text x="75" y="90" textAnchor="middle" className="fill-muted-foreground" fontSize="10">Name, client, approvals</text>

          {/* Arrow 1-2 */}
          <line x1="145" y1="65" x2="170" y2="65" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#ov-arrow)" />

          {/* Step 2 */}
          <rect x="175" y="30" width="140" height="70" rx="8" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="245" y="55" textAnchor="middle" className="fill-foreground font-medium" fontSize="12">2. Configure</text>
          <text x="245" y="72" textAnchor="middle" className="fill-foreground font-medium" fontSize="12">Hardware</text>
          <text x="245" y="90" textAnchor="middle" className="fill-muted-foreground" fontSize="10">PLCs, carriers, IO cards</text>

          {/* Arrow 2-3 */}
          <line x1="315" y1="65" x2="340" y2="65" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#ov-arrow)" />

          {/* Step 3 */}
          <rect x="345" y="30" width="140" height="70" rx="8" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="415" y="55" textAnchor="middle" className="fill-foreground font-medium" fontSize="12">3. Define</text>
          <text x="415" y="72" textAnchor="middle" className="fill-foreground font-medium" fontSize="12">Signals</text>
          <text x="415" y="90" textAnchor="middle" className="fill-muted-foreground" fontSize="10">Tags, types, alarms</text>

          {/* Arrow 3-4 */}
          <line x1="485" y1="65" x2="510" y2="65" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#ov-arrow)" />

          {/* Step 4 */}
          <rect x="515" y="30" width="140" height="70" rx="8" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="585" y="55" textAnchor="middle" className="fill-foreground font-medium" fontSize="12">4. Export to</text>
          <text x="585" y="72" textAnchor="middle" className="fill-foreground font-medium" fontSize="12">CODESYS</text>
          <text x="585" y="90" textAnchor="middle" className="fill-muted-foreground" fontSize="10">GVLs, HW config, code</text>

          {/* Phase labels */}
          <text x="75" y="120" textAnchor="middle" className="fill-muted-foreground" fontSize="9">Projects page</text>
          <text x="245" y="120" textAnchor="middle" className="fill-muted-foreground" fontSize="9">Hardware page</text>
          <text x="415" y="120" textAnchor="middle" className="fill-muted-foreground" fontSize="9">Signals page</text>
          <text x="585" y="120" textAnchor="middle" className="fill-muted-foreground" fontSize="9">CODESYS Plugin</text>
        </svg>
      </div>

      <h3>Phase 1: Create Project</h3>
      <p>
        Start by creating a project with a name, project number, client, and location.
        Select which hardware approvals apply (e.g., DNV GL, Lloyd&apos;s) to filter the
        catalog of available PLCs and IO modules to only approved equipment.
      </p>

      <h3>Phase 2: Configure Hardware</h3>
      <p>
        Add PLCs from the device catalog, configure their Ethernet ports and IP networks,
        then add fieldbus couplers (carriers) connected via buses. Assign IO modules
        (cards) to carrier slots from the approved module catalog. Each card occupies a
        numbered slot and provides input or output channels for signals.
      </p>

      <h3>Phase 3: Define Signals</h3>
      <p>
        Create signals that represent physical measurements and control outputs. Each
        signal has a tag name, type (discrete or analog), direction (input or output),
        and is bound to a specific channel on an IO card. Configure alarm thresholds,
        scaling parameters, and engineering units. You can also use component templates
        to instantiate pre-defined signal sets for common devices like pumps and valves.
      </p>

      <h3>Phase 4: Export to CODESYS</h3>
      <p>
        The CODESYS plugin connects to the MIAS-IO REST API and pulls the complete
        hardware and signal configuration into a CODESYS project. It generates Global
        Variable Lists (GVLs), hardware device trees, and IO channel mappings
        automatically.
      </p>

      <h2>Key Concepts</h2>

      {/* Data hierarchy diagram */}
      <div className="my-8 flex justify-center">
        <svg viewBox="0 0 500 340" className="w-full max-w-lg" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="ov-hier-arrow" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 3.5 L 0 7 z" className="fill-foreground" />
            </marker>
          </defs>

          {/* Project */}
          <rect x="150" y="10" width="200" height="44" rx="8" className="fill-primary/15 stroke-primary" strokeWidth="1.5" />
          <text x="250" y="37" textAnchor="middle" className="fill-foreground font-medium" fontSize="13">Project</text>

          {/* Arrow */}
          <line x1="250" y1="54" x2="250" y2="72" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#ov-hier-arrow)" />

          {/* PLC */}
          <rect x="150" y="76" width="200" height="44" rx="8" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="250" y="103" textAnchor="middle" className="fill-foreground font-medium" fontSize="13">PLC</text>

          {/* Arrow */}
          <line x1="250" y1="120" x2="250" y2="138" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#ov-hier-arrow)" />

          {/* Carrier */}
          <rect x="150" y="142" width="200" height="44" rx="8" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="250" y="160" textAnchor="middle" className="fill-foreground font-medium" fontSize="13">IO Carrier (Coupler)</text>
          <text x="250" y="176" textAnchor="middle" className="fill-muted-foreground" fontSize="10">Cabinet + carrier number</text>

          {/* Arrow */}
          <line x1="250" y1="186" x2="250" y2="204" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#ov-hier-arrow)" />

          {/* IO Card */}
          <rect x="150" y="208" width="200" height="44" rx="8" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="250" y="226" textAnchor="middle" className="fill-foreground font-medium" fontSize="13">IO Card (Module)</text>
          <text x="250" y="242" textAnchor="middle" className="fill-muted-foreground" fontSize="10">Slot position, type code</text>

          {/* Arrow */}
          <line x1="250" y1="252" x2="250" y2="270" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#ov-hier-arrow)" />

          {/* Signal */}
          <rect x="150" y="274" width="200" height="44" rx="8" className="fill-primary/15 stroke-primary" strokeWidth="1.5" />
          <text x="250" y="292" textAnchor="middle" className="fill-foreground font-medium" fontSize="13">Signal</text>
          <text x="250" y="308" textAnchor="middle" className="fill-muted-foreground" fontSize="10">Channel position on card</text>

          {/* Side annotations */}
          <text x="370" y="37" className="fill-muted-foreground" fontSize="10">Top-level container</text>
          <text x="370" y="103" className="fill-muted-foreground" fontSize="10">Controller hardware</text>
          <text x="370" y="160" className="fill-muted-foreground" fontSize="10">Remote IO node</text>
          <text x="370" y="226" className="fill-muted-foreground" fontSize="10">DI / DO / AI / AO module</text>
          <text x="370" y="292" className="fill-muted-foreground" fontSize="10">Physical measurement</text>
        </svg>
      </div>

      <table>
        <thead>
          <tr>
            <th>Concept</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Project</strong></td>
            <td>Top-level container. All data (hardware, signals, networks) is scoped to a project. Projects have a status lifecycle: Active, On Hold, Completed, Archived.</td>
          </tr>
          <tr>
            <td><strong>PLC</strong></td>
            <td>A programmable logic controller selected from the device catalog. Each PLC has Ethernet ports, can host IP networks and buses, and manages a set of IO carriers.</td>
          </tr>
          <tr>
            <td><strong>IO Carrier</strong></td>
            <td>A fieldbus coupler or remote IO node (e.g., WAGO 750-series coupler). Carriers have numbered slots where IO cards are inserted. Each carrier has a cabinet number and carrier number for hardware identification.</td>
          </tr>
          <tr>
            <td><strong>IO Card</strong></td>
            <td>An IO module inserted into a carrier slot. Cards have a type (DI, DO, AI, AO, etc.) and provide channels for signals. Each card gets a type code letter and instance number for unique identification.</td>
          </tr>
          <tr>
            <td><strong>Signal</strong></td>
            <td>A named measurement or control point bound to a specific channel on an IO card. Signals are either discrete (on/off) or analog (scaled value), with separate child tables for type-specific properties.</td>
          </tr>
          <tr>
            <td><strong>Component</strong></td>
            <td>A reusable template defining the signal set for a device type (e.g., a pump with start/stop/running/fault signals). Instantiating a component in a project creates all its signals automatically.</td>
          </tr>
          <tr>
            <td><strong>Bus / Network</strong></td>
            <td>Communication links. IP Networks represent Ethernet infrastructure. Buses carry fieldbus protocols (Modbus, CANopen, PROFINET, etc.) and connect PLCs and carriers.</td>
          </tr>
          <tr>
            <td><strong>Approval</strong></td>
            <td>Classification authority tags (e.g., DNV GL, Lloyd&apos;s Register). Projects select which approvals apply, and only hardware catalog entries with matching approvals appear in selection dialogs.</td>
          </tr>
        </tbody>
      </table>

      <h2>Navigation</h2>
      <p>
        The main navigation bar provides access to the five primary areas of the application:
      </p>
      <ul>
        <li><strong>Projects</strong> &mdash; Create and manage projects. Click a project to access its details, hardware, and signals.</li>
        <li><strong>Hardware</strong> &mdash; Manage the global hardware catalog: PLC models, fieldbus couplers, and IO modules.</li>
        <li><strong>Components</strong> &mdash; Create and manage reusable component templates and their signal definitions.</li>
        <li><strong>Misc</strong> &mdash; Engineering units, signal systems, GVL definitions, and other reference data.</li>
        <li><strong>Manual</strong> &mdash; This documentation (you are here).</li>
      </ul>
      <p>
        Admin users also see an <strong>Admin</strong> link for user management. The top-right corner
        contains the CODESYS connection indicator, a feedback button, the theme toggle
        (light/dark mode), and the user menu.
      </p>
    </article>
  );
}

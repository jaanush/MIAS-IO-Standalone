export function HardwareSection() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <h1>Hardware Setup</h1>
      <p className="lead text-muted-foreground">
        The hardware page is a two-panel view showing the hardware tree on the left
        and a detail/edit form on the right. All hardware configuration happens here:
        PLCs, carriers, IO cards, ethernet ports, and network assignments.
      </p>

      <h2>Hardware Hierarchy</h2>
      <p>
        MIAS-IO models hardware in a strict parent-child hierarchy. Every carrier
        belongs to a PLC, and every IO card belongs to a carrier. This reflects the
        physical topology of a PLC system with remote IO nodes.
      </p>

      {/* Hardware tree diagram */}
      <div className="my-8 flex justify-center">
        <svg viewBox="0 0 680 360" className="w-full max-w-2xl" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="hw-arrow" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 3.5 L 0 7 z" className="fill-foreground" />
            </marker>
          </defs>

          {/* PLC */}
          <rect x="240" y="10" width="200" height="50" rx="8" className="fill-primary/15 stroke-primary" strokeWidth="1.5" />
          <text x="340" y="32" textAnchor="middle" className="fill-foreground font-medium" fontSize="13">PLC</text>
          <text x="340" y="48" textAnchor="middle" className="fill-muted-foreground" fontSize="10">WAGO PFC200 (750-8212)</text>

          {/* Lines from PLC to carriers */}
          <line x1="290" y1="60" x2="290" y2="80" className="stroke-foreground/50" strokeWidth="1" />
          <line x1="130" y1="80" x2="550" y2="80" className="stroke-foreground/50" strokeWidth="1" />

          {/* Left branch - Local Bus */}
          <line x1="130" y1="80" x2="130" y2="95" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#hw-arrow)" />
          <rect x="30" y="100" width="200" height="50" rx="8" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="130" y="122" textAnchor="middle" className="fill-foreground font-medium" fontSize="12">Local Bus Carrier</text>
          <text x="130" y="138" textAnchor="middle" className="fill-muted-foreground" fontSize="10">PLC built-in Kbus</text>

          {/* Middle branch - Remote Carrier 1 */}
          <line x1="340" y1="80" x2="340" y2="95" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#hw-arrow)" />
          <rect x="240" y="100" width="200" height="50" rx="8" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="340" y="122" textAnchor="middle" className="fill-foreground font-medium" fontSize="12">Carrier N3:D01</text>
          <text x="340" y="138" textAnchor="middle" className="fill-muted-foreground" fontSize="10">750-352 via Modbus TCP</text>

          {/* Right branch - Remote Carrier 2 */}
          <line x1="550" y1="80" x2="550" y2="95" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#hw-arrow)" />
          <rect x="450" y="100" width="200" height="50" rx="8" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="550" y="122" textAnchor="middle" className="fill-foreground font-medium" fontSize="12">Carrier N3:D02</text>
          <text x="550" y="138" textAnchor="middle" className="fill-muted-foreground" fontSize="10">750-352 via Modbus TCP</text>

          {/* IO Cards for middle carrier */}
          <line x1="280" y1="150" x2="280" y2="170" className="stroke-foreground/50" strokeWidth="1" />
          <line x1="340" y1="150" x2="340" y2="170" className="stroke-foreground/50" strokeWidth="1" />
          <line x1="400" y1="150" x2="400" y2="170" className="stroke-foreground/50" strokeWidth="1" />

          {/* Card slots */}
          <rect x="258" y="175" width="44" height="35" rx="4" className="fill-primary/10 stroke-primary/60" strokeWidth="1" />
          <text x="280" y="190" textAnchor="middle" className="fill-foreground" fontSize="9">DI</text>
          <text x="280" y="202" textAnchor="middle" className="fill-muted-foreground" fontSize="8">Slot 1</text>

          <rect x="318" y="175" width="44" height="35" rx="4" className="fill-primary/10 stroke-primary/60" strokeWidth="1" />
          <text x="340" y="190" textAnchor="middle" className="fill-foreground" fontSize="9">DI</text>
          <text x="340" y="202" textAnchor="middle" className="fill-muted-foreground" fontSize="8">Slot 2</text>

          <rect x="378" y="175" width="44" height="35" rx="4" className="fill-primary/10 stroke-primary/60" strokeWidth="1" />
          <text x="400" y="190" textAnchor="middle" className="fill-foreground" fontSize="9">DO</text>
          <text x="400" y="202" textAnchor="middle" className="fill-muted-foreground" fontSize="8">Slot 3</text>

          {/* IO Cards for right carrier */}
          <line x1="490" y1="150" x2="490" y2="170" className="stroke-foreground/50" strokeWidth="1" />
          <line x1="550" y1="150" x2="550" y2="170" className="stroke-foreground/50" strokeWidth="1" />
          <line x1="610" y1="150" x2="610" y2="170" className="stroke-foreground/50" strokeWidth="1" />

          <rect x="468" y="175" width="44" height="35" rx="4" className="fill-primary/10 stroke-primary/60" strokeWidth="1" />
          <text x="490" y="190" textAnchor="middle" className="fill-foreground" fontSize="9">AI</text>
          <text x="490" y="202" textAnchor="middle" className="fill-muted-foreground" fontSize="8">Slot 1</text>

          <rect x="528" y="175" width="44" height="35" rx="4" className="fill-primary/10 stroke-primary/60" strokeWidth="1" />
          <text x="550" y="190" textAnchor="middle" className="fill-foreground" fontSize="9">AI</text>
          <text x="550" y="202" textAnchor="middle" className="fill-muted-foreground" fontSize="8">Slot 2</text>

          <rect x="588" y="175" width="44" height="35" rx="4" className="fill-primary/10 stroke-primary/60" strokeWidth="1" />
          <text x="610" y="190" textAnchor="middle" className="fill-foreground" fontSize="9">AO</text>
          <text x="610" y="202" textAnchor="middle" className="fill-muted-foreground" fontSize="8">Slot 3</text>

          {/* Legend */}
          <rect x="30" y="250" width="620" height="100" rx="8" className="fill-muted/50 stroke-border" strokeWidth="1" strokeDasharray="4 2" />
          <text x="50" y="272" className="fill-muted-foreground font-medium" fontSize="11">Card Types:</text>
          <text x="50" y="290" className="fill-muted-foreground" fontSize="10">DI = Digital Input | DO = Digital Output | AI = Analog Input | AO = Analog Output</text>
          <text x="50" y="306" className="fill-muted-foreground" fontSize="10">COUNTER | PWM | SERIAL | IO_LINK | SUPPLY | RELAY | MIXED</text>
          <text x="50" y="330" className="fill-muted-foreground" fontSize="10">Local Bus = PLC&apos;s built-in Kbus (excluded from CODESYS sync). Remote = connected via bus.</text>
        </svg>
      </div>

      <h2>PLC Configuration</h2>
      <p>
        A PLC is the top-level hardware entity within a project. To add a PLC, click
        the <strong>Add PLC</strong> button in the hardware tree. You will be prompted to:
      </p>
      <ol>
        <li>Search and select a PLC model from the device catalog (filtered by project approvals).</li>
        <li>Enter a name for this PLC instance (e.g., &quot;PLC-01 Engine Room&quot;).</li>
        <li>Optionally set the IP address.</li>
      </ol>

      <h3>Ethernet Ports</h3>
      <p>
        PLCs with multiple Ethernet ports show a port configuration section. For each port you can set:
      </p>
      <ul>
        <li><strong>Label</strong> &mdash; A descriptive name (e.g., &quot;X1&quot;, &quot;X2&quot;).</li>
        <li><strong>IP Address</strong> &mdash; The port&apos;s IP address.</li>
        <li><strong>IP Network</strong> &mdash; Which IP Network this port connects to.</li>
      </ul>

      <h3>Local Bus Initialization</h3>
      <p>
        Every WAGO PLC has a built-in local bus (Kbus) for IO modules mounted directly
        on the PLC backplane. Click <strong>Initialize Local Bus</strong> on the PLC detail
        panel to create the local carrier. Local carriers are flagged
        with <code>isLocalBus = true</code> and are excluded from CODESYS remote device synchronization.
      </p>

      <h2>Carrier Configuration</h2>
      <p>
        Carriers (fieldbus couplers) are remote IO nodes connected to a PLC via a bus.
        To add a carrier, click <strong>Add Carrier</strong> in the hardware tree under a PLC.
      </p>

      <h3>Carrier Fields</h3>
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Name</td>
            <td>Descriptive label for the carrier (e.g., &quot;Engine Room Frame 3&quot;).</td>
          </tr>
          <tr>
            <td>Catalog Entry</td>
            <td>The coupler model from the device catalog (e.g., WAGO 750-352).</td>
          </tr>
          <tr>
            <td>Bus</td>
            <td>Which bus this carrier is connected to (e.g., a Modbus TCP bus).</td>
          </tr>
          <tr>
            <td>Cabinet Number</td>
            <td>Physical cabinet identifier (1-9). Used in hardware identifiers.</td>
          </tr>
          <tr>
            <td>Carrier Number</td>
            <td>Carrier number within the cabinet (01-99). Used in hardware identifiers.</td>
          </tr>
          <tr>
            <td>IP Address</td>
            <td>The carrier&apos;s IP address for Ethernet-connected couplers.</td>
          </tr>
          <tr>
            <td>Firmware Version</td>
            <td>Installed firmware version for documentation purposes.</td>
          </tr>
          <tr>
            <td>Modbus Input Base</td>
            <td>Start word address for this carrier in the Modbus input data table (BCInputData).</td>
          </tr>
          <tr>
            <td>Modbus Output Base</td>
            <td>Start word address for this carrier in the Modbus output data table (BCOutputData).</td>
          </tr>
        </tbody>
      </table>

      <h2>IO Card Management</h2>
      <p>
        IO cards (modules) are inserted into carrier slots. Each carrier has a maximum
        number of slots defined by its catalog entry. Cards provide the physical channels
        where signals are wired.
      </p>

      <h3>Assigning Cards to Slots</h3>
      <p>
        The card list shows all occupied and empty slots for the selected carrier. To
        assign a card:
      </p>
      <ol>
        <li>Click an empty slot or use the <strong>Add Card</strong> button.</li>
        <li>The Module Picker dialog opens, showing only modules that match the project&apos;s approvals.</li>
        <li>Filter by card type (DI, DO, AI, AO, etc.) and select the desired module.</li>
        <li>The card is assigned to the slot and inherits properties from the catalog entry.</li>
      </ol>

      <h3>Card Properties</h3>
      <table>
        <thead>
          <tr>
            <th>Property</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>Slot Position</td>
            <td>The physical slot number on the carrier (1 to maxModules).</td>
          </tr>
          <tr>
            <td>Card Type</td>
            <td>The IO type: DI, DO, AI, AO, MIXED, COUNTER, PWM, SERIAL, IO_LINK, SUPPLY, or RELAY.</td>
          </tr>
          <tr>
            <td>Subgroup</td>
            <td>A single letter (A, B, C...) identifying the fuse group. Cards in the same subgroup share a power supply fuse.</td>
          </tr>
          <tr>
            <td>Type Code</td>
            <td>A single letter identifying the card type within the hardware identifier system (e.g., I for DI, M for DO, Q for AI).</td>
          </tr>
          <tr>
            <td>Instance Number</td>
            <td>Sequential number (01-99) within the subgroup+type combination.</td>
          </tr>
        </tbody>
      </table>

      <h3>Drag and Drop Reordering</h3>
      <p>
        Cards can be reordered between subgroups by dragging them in the card list.
        When you drag a card to a different subgroup, it is reassigned to that group
        and its instance number is recalculated. Slot positions are updated automatically
        to maintain a contiguous sequence.
      </p>

      <h2>Hardware Identifiers</h2>
      <p>
        Every IO card in the system receives a unique hardware identifier following
        the pattern:
      </p>
      <p className="text-center">
        <code className="text-base">N&#123;cabinet&#125;:D&#123;carrier&#125;:&#123;subgroup&#125;&#123;typeCode&#125;&#123;instance&#125;</code>
      </p>

      {/* Hardware identifier breakdown */}
      <div className="my-8 flex justify-center">
        <svg viewBox="0 0 600 200" className="w-full max-w-xl" xmlns="http://www.w3.org/2000/svg">
          {/* Example identifier */}
          <text x="300" y="30" textAnchor="middle" className="fill-foreground font-mono font-bold" fontSize="22">N3:D02:BI01</text>

          {/* Bracket lines pointing down to labels */}
          {/* N3 */}
          <line x1="178" y1="40" x2="178" y2="60" className="stroke-primary" strokeWidth="1.5" />
          <line x1="200" y1="40" x2="200" y2="60" className="stroke-primary" strokeWidth="1.5" />
          <line x1="178" y1="60" x2="200" y2="60" className="stroke-primary" strokeWidth="1.5" />
          <line x1="189" y1="60" x2="189" y2="75" className="stroke-primary" strokeWidth="1.5" />
          <rect x="134" y="80" width="110" height="40" rx="6" className="fill-primary/10 stroke-primary/50" strokeWidth="1" />
          <text x="189" y="97" textAnchor="middle" className="fill-foreground" fontSize="11">Cabinet N3</text>
          <text x="189" y="112" textAnchor="middle" className="fill-muted-foreground" fontSize="9">Cabinet number (1-9)</text>

          {/* D02 */}
          <line x1="233" y1="40" x2="233" y2="60" className="stroke-primary" strokeWidth="1.5" />
          <line x1="275" y1="40" x2="275" y2="60" className="stroke-primary" strokeWidth="1.5" />
          <line x1="233" y1="60" x2="275" y2="60" className="stroke-primary" strokeWidth="1.5" />
          <line x1="254" y1="60" x2="254" y2="75" className="stroke-primary" strokeWidth="1.5" />
          <rect x="199" y="130" width="110" height="40" rx="6" className="fill-primary/10 stroke-primary/50" strokeWidth="1" />
          <text x="254" y="147" textAnchor="middle" className="fill-foreground" fontSize="11">Carrier D02</text>
          <text x="254" y="162" textAnchor="middle" className="fill-muted-foreground" fontSize="9">Carrier number (01-99)</text>
          <line x1="254" y1="75" x2="254" y2="125" className="stroke-primary" strokeWidth="1.5" />

          {/* B */}
          <line x1="310" y1="40" x2="310" y2="60" className="stroke-primary" strokeWidth="1.5" />
          <line x1="325" y1="40" x2="325" y2="60" className="stroke-primary" strokeWidth="1.5" />
          <line x1="310" y1="60" x2="325" y2="60" className="stroke-primary" strokeWidth="1.5" />
          <line x1="317" y1="60" x2="317" y2="75" className="stroke-primary" strokeWidth="1.5" />
          <rect x="262" y="80" width="110" height="40" rx="6" className="fill-primary/10 stroke-primary/50" strokeWidth="1" />
          <text x="317" y="97" textAnchor="middle" className="fill-foreground" fontSize="11">Subgroup B</text>
          <text x="317" y="112" textAnchor="middle" className="fill-muted-foreground" fontSize="9">Fuse group (A-Z)</text>

          {/* I */}
          <line x1="340" y1="40" x2="340" y2="60" className="stroke-primary" strokeWidth="1.5" />
          <line x1="355" y1="40" x2="355" y2="60" className="stroke-primary" strokeWidth="1.5" />
          <line x1="340" y1="60" x2="355" y2="60" className="stroke-primary" strokeWidth="1.5" />
          <line x1="347" y1="60" x2="347" y2="75" className="stroke-primary" strokeWidth="1.5" />
          <rect x="292" y="130" width="110" height="40" rx="6" className="fill-primary/10 stroke-primary/50" strokeWidth="1" />
          <text x="347" y="147" textAnchor="middle" className="fill-foreground" fontSize="11">Type Code I</text>
          <text x="347" y="162" textAnchor="middle" className="fill-muted-foreground" fontSize="9">DI module (I-L)</text>
          <line x1="347" y1="75" x2="347" y2="125" className="stroke-primary" strokeWidth="1.5" />

          {/* 01 */}
          <line x1="368" y1="40" x2="368" y2="60" className="stroke-primary" strokeWidth="1.5" />
          <line x1="398" y1="40" x2="398" y2="60" className="stroke-primary" strokeWidth="1.5" />
          <line x1="368" y1="60" x2="398" y2="60" className="stroke-primary" strokeWidth="1.5" />
          <line x1="383" y1="60" x2="383" y2="75" className="stroke-primary" strokeWidth="1.5" />
          <rect x="328" y="80" width="110" height="40" rx="6" className="fill-primary/10 stroke-primary/50" strokeWidth="1" />
          <text x="383" y="97" textAnchor="middle" className="fill-foreground" fontSize="11">Instance 01</text>
          <text x="383" y="112" textAnchor="middle" className="fill-muted-foreground" fontSize="9">Sequence (01-99)</text>
        </svg>
      </div>

      <h3>Module Type Codes</h3>
      <p>
        Each IO card type maps to a set of type code letters. The system maintains a
        lookup table (ModuleTypeCode) that assigns letters to card types:
      </p>
      <table>
        <thead>
          <tr>
            <th>Card Type</th>
            <th>Type Codes</th>
            <th>Group</th>
          </tr>
        </thead>
        <tbody>
          <tr><td>SUPPLY</td><td>A, B, C, D</td><td>Power Supply</td></tr>
          <tr><td>SERIAL</td><td>E, F, G, H</td><td>Serial / Communication</td></tr>
          <tr><td>DI</td><td>I, J, K, L</td><td>Digital Input</td></tr>
          <tr><td>DO</td><td>M, N, O, P</td><td>Digital Output</td></tr>
          <tr><td>AI</td><td>Q, R, S, T</td><td>Analog Input</td></tr>
          <tr><td>AO</td><td>U, V, W, X</td><td>Analog Output</td></tr>
        </tbody>
      </table>
      <p>
        Each card type gets up to 4 letters, allowing differentiation when a carrier
        has many modules of the same type. The first letter in each group is used by
        default; additional letters are assigned automatically as needed.
      </p>

      <h2>Hardware Catalog</h2>
      <p>
        The hardware catalog is managed from the top-level <strong>Hardware</strong> navigation
        tab (not within a project). It contains three sections:
      </p>
      <ul>
        <li><strong>PLCs</strong> &mdash; PLC controller models (DeviceCatalog with type = PLC).</li>
        <li><strong>Couplers</strong> &mdash; Fieldbus coupler models (DeviceCatalog with type = COUPLER).</li>
        <li><strong>Modules</strong> &mdash; IO module models (ModuleCatalog) with detailed specifications for channel counts, signal ranges, power consumption, and environmental ratings.</li>
      </ul>
      <p>
        Catalog entries track lifecycle status (Active, NRND, Last Buy, Discontinued,
        Obsolete) to help engineers avoid selecting end-of-life hardware.
      </p>

      <h2>Hard Delete Policy</h2>
      <p>
        PLCs, carriers, and IO cards use <strong>hard delete</strong> &mdash; when you remove
        one of these entities, it is permanently deleted from the database along with
        all child records. There is no soft-delete or recycle bin for hardware entities.
      </p>
      <p>
        Signals that were bound to a deleted card are unbound (their <code>ioCardId</code> is
        set to NULL) but the signals themselves are preserved. The hardware identifier
        fields on the signal (<code>hwCabinet</code>, <code>hwCarrier</code>, <code>hwTypeCode</code>,
        <code>hwInstance</code>) survive card deletion, providing a stable reference that can
        be used to rebind signals when hardware is replaced.
      </p>
    </article>
  );
}

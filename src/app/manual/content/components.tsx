export function ComponentsSection() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <h1>Components &amp; Templates</h1>
      <p className="lead text-muted-foreground">
        Components are reusable signal templates for physical devices like pumps, valves,
        frequency converters, and sensors. Define a component once, then instantiate it
        across projects to create consistent signal sets automatically.
      </p>

      <h2>What are Components?</h2>
      <p>
        A <strong>HardwareComponent</strong> defines the signal interface of a device type.
        For example, a &quot;Centrifugal Pump&quot; component might define signals for start command,
        stop command, running feedback, fault feedback, bearing temperature, and discharge
        pressure. When you instantiate this component in a project, all six signals are
        created automatically with the correct types, defaults, and alarm configurations.
      </p>
      <p>
        Components can be <strong>global</strong> (shared across all projects, <code>projectId = NULL</code>)
        or <strong>project-private</strong> (visible only within one project). Global components
        serve as a company-wide library of device templates.
      </p>

      {/* Component flow diagram */}
      <div className="my-8 flex justify-center">
        <svg viewBox="0 0 700 300" className="w-full max-w-2xl" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="comp-arrow" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 3.5 L 0 7 z" className="fill-foreground" />
            </marker>
          </defs>

          {/* Component Template */}
          <rect x="20" y="30" width="180" height="110" rx="8" className="fill-primary/15 stroke-primary" strokeWidth="1.5" />
          <text x="110" y="52" textAnchor="middle" className="fill-foreground font-medium" fontSize="13">Component Template</text>
          <text x="110" y="70" textAnchor="middle" className="fill-muted-foreground" fontSize="10">&quot;Centrifugal Pump&quot;</text>
          <line x1="40" y1="80" x2="180" y2="80" className="stroke-border" strokeWidth="1" />
          <text x="45" y="96" className="fill-muted-foreground" fontSize="9">Signal: Start (DO)</text>
          <text x="45" y="108" className="fill-muted-foreground" fontSize="9">Signal: Running (DI)</text>
          <text x="45" y="120" className="fill-muted-foreground" fontSize="9">Signal: Fault (DI)</text>
          <text x="45" y="132" className="fill-muted-foreground" fontSize="9">Signal: BearingTemp (AI)</text>

          {/* Arrow to Instance */}
          <line x1="200" y1="85" x2="250" y2="55" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#comp-arrow)" />
          <line x1="200" y1="85" x2="250" y2="165" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#comp-arrow)" />

          <text x="230" y="50" className="fill-muted-foreground" fontSize="9" textAnchor="middle">instantiate</text>
          <text x="230" y="160" className="fill-muted-foreground" fontSize="9" textAnchor="middle">instantiate</text>

          {/* Instance 1 */}
          <rect x="255" y="20" width="170" height="70" rx="8" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="340" y="42" textAnchor="middle" className="fill-foreground font-medium" fontSize="12">Instance: FW_Pump1</text>
          <text x="340" y="58" textAnchor="middle" className="fill-muted-foreground" fontSize="10">tag = &quot;FW_Pump1&quot;</text>
          <text x="340" y="74" textAnchor="middle" className="fill-muted-foreground" fontSize="10">Bus: Modbus TCP #1</text>

          {/* Instance 2 */}
          <rect x="255" y="130" width="170" height="70" rx="8" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="340" y="152" textAnchor="middle" className="fill-foreground font-medium" fontSize="12">Instance: FW_Pump2</text>
          <text x="340" y="168" textAnchor="middle" className="fill-muted-foreground" fontSize="10">tag = &quot;FW_Pump2&quot;</text>
          <text x="340" y="184" textAnchor="middle" className="fill-muted-foreground" fontSize="10">Bus: Modbus TCP #1</text>

          {/* Arrow to Signals */}
          <line x1="425" y1="55" x2="475" y2="35" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#comp-arrow)" />
          <line x1="425" y1="55" x2="475" y2="65" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#comp-arrow)" />
          <line x1="425" y1="165" x2="475" y2="145" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#comp-arrow)" />
          <line x1="425" y1="165" x2="475" y2="175" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#comp-arrow)" />

          {/* Signals */}
          <rect x="480" y="15" width="195" height="30" rx="4" className="fill-muted/60 stroke-border" strokeWidth="1" />
          <text x="577" y="34" textAnchor="middle" className="fill-foreground" fontSize="10">FW_Pump1_Start (DO)</text>

          <rect x="480" y="50" width="195" height="30" rx="4" className="fill-muted/60 stroke-border" strokeWidth="1" />
          <text x="577" y="69" textAnchor="middle" className="fill-foreground" fontSize="10">FW_Pump1_BearingTemp (AI)</text>

          <rect x="480" y="125" width="195" height="30" rx="4" className="fill-muted/60 stroke-border" strokeWidth="1" />
          <text x="577" y="144" textAnchor="middle" className="fill-foreground" fontSize="10">FW_Pump2_Start (DO)</text>

          <rect x="480" y="160" width="195" height="30" rx="4" className="fill-muted/60 stroke-border" strokeWidth="1" />
          <text x="577" y="179" textAnchor="middle" className="fill-foreground" fontSize="10">FW_Pump2_BearingTemp (AI)</text>

          <text x="577" y="85" textAnchor="middle" className="fill-muted-foreground" fontSize="9">... + Running, Fault signals</text>
          <text x="577" y="205" textAnchor="middle" className="fill-muted-foreground" fontSize="9">... + Running, Fault signals</text>

          {/* Labels */}
          <rect x="20" y="250" width="655" height="40" rx="6" className="fill-muted/30 stroke-border" strokeWidth="1" strokeDasharray="4 2" />
          <text x="40" y="270" className="fill-muted-foreground" fontSize="10">Template defines signal pattern</text>
          <text x="280" y="270" className="fill-muted-foreground" fontSize="10">Instance = one physical device</text>
          <text x="505" y="270" className="fill-muted-foreground" fontSize="10">Project Signal rows (tag = instance.tag + suffix)</text>
        </svg>
      </div>

      <h2>Component Properties</h2>
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Name</strong></td>
            <td>The component type name (e.g., &quot;Centrifugal Pump&quot;, &quot;Butterfly Valve&quot;).</td>
          </tr>
          <tr>
            <td><strong>Manufacturer</strong></td>
            <td>Device manufacturer (e.g., &quot;Grundfos&quot;, &quot;ABB&quot;).</td>
          </tr>
          <tr>
            <td><strong>Model</strong></td>
            <td>Specific model designation.</td>
          </tr>
          <tr>
            <td><strong>Version</strong></td>
            <td>Component template version for tracking changes.</td>
          </tr>
          <tr>
            <td><strong>Function Block</strong></td>
            <td>The CODESYS function block type used to control this device (e.g., &quot;FB_Pump&quot;).</td>
          </tr>
          <tr>
            <td><strong>Bus Protocol</strong></td>
            <td>The default communication protocol (MODBUS_TCP, CANOPEN, etc.). Determines which bus-addressing fields are relevant.</td>
          </tr>
          <tr>
            <td><strong>Status</strong></td>
            <td>DRAFT (in progress), ACTIVE (ready for use), or DEPRECATED (replaced by a newer version).</td>
          </tr>
          <tr>
            <td><strong>Parent</strong></td>
            <td>Optional parent component for inheritance. Child components inherit the parent&apos;s signals.</td>
          </tr>
        </tbody>
      </table>

      <h2>Component Hierarchy (Parent/Child Inheritance)</h2>
      <p>
        Components can form a parent-child hierarchy. A child component inherits all
        signals from its parent and can add additional signals specific to the child type.
        This is useful for grouping common signals:
      </p>
      <ul>
        <li>
          <strong>Parent: &quot;Electric Motor&quot;</strong> &mdash; defines signals common to all motors
          (running, fault, current, temperature).
        </li>
        <li>
          <strong>Child: &quot;Frequency Converter Motor&quot;</strong> &mdash; inherits motor signals and adds
          speed setpoint, speed feedback, frequency output, and converter-specific alarms.
        </li>
        <li>
          <strong>Child: &quot;Direct-On-Line Motor&quot;</strong> &mdash; inherits motor signals and adds
          start/stop commands and overload relay feedback.
        </li>
      </ul>
      <p>
        Signal resolution walks up the parent chain. If a child defines a signal at
        the same <code>channelOffset</code> as a parent signal, the child&apos;s definition
        overrides the parent.
      </p>

      <h2>Component Signals</h2>
      <p>
        Each component defines a set of <strong>ComponentSignal</strong> records. These are
        template signal definitions, not actual project signals &mdash; they become real
        signals only when the component is instantiated.
      </p>
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Channel Offset</strong></td>
            <td>A logical channel number (0, 1, 2, ...) identifying this signal within the component. Must be unique per component.</td>
          </tr>
          <tr>
            <td><strong>IO Type</strong></td>
            <td>DI, DO, AI, or AO &mdash; the signal&apos;s IO type.</td>
          </tr>
          <tr>
            <td><strong>Tag Suffix</strong></td>
            <td>Appended to the instance tag to form the signal tag (e.g., suffix &quot;_Running&quot; + instance tag &quot;FW_Pump1&quot; = &quot;FW_Pump1_Running&quot;).</td>
          </tr>
          <tr>
            <td><strong>Description</strong></td>
            <td>Default description for signals created from this template.</td>
          </tr>
          <tr>
            <td><strong>Active</strong></td>
            <td>Whether this signal is active. Inactive signals are skipped during instantiation.</td>
          </tr>
        </tbody>
      </table>

      <h3>Default Values</h3>
      <p>
        Component signals carry default values for all type-specific properties. When
        an instance is created, these defaults are applied to the generated signals:
      </p>
      <ul>
        <li><strong>Discrete defaults:</strong> trigger (NO/NC), filter time, switching type, signal voltage.</li>
        <li><strong>Analog defaults:</strong> input type, wire config, raw/scale ranges, engineering unit, sensor fail detection settings.</li>
        <li><strong>Bus addressing:</strong> CAN ID, node ID, bit offset/length, Modbus register type/offset, CANopen index.</li>
        <li><strong>Alarm defaults:</strong> alarm group, block masks, FAT block, suppression expressions.</li>
        <li><strong>Code gen defaults:</strong> retain, persistent, logging, FB name override, short name.</li>
      </ul>

      <h3>Component Alarms</h3>
      <p>
        Component signals can also define default alarm configurations
        via <code>ComponentDiscreteAlarm</code> and <code>ComponentAnalogAlarm</code> records.
        These are copied to the signal-level alarm tables when instances are created.
      </p>

      <h2>Component Instances</h2>
      <p>
        A <strong>ComponentInstance</strong> represents one physical device in a project,
        created from a component template. When you instantiate a component:
      </p>
      <ol>
        <li>A <code>ComponentInstance</code> record is created with a name, tag, and optional bus assignment.</li>
        <li>For each active <code>ComponentSignal</code> in the component (including inherited parent signals), an <code>InstanceSignal</code> record is created.</li>
        <li>Each <code>InstanceSignal</code> links to one or more <code>Signal</code> records in the project (supporting redundant wiring).</li>
        <li>Signal properties are populated from the component signal defaults.</li>
      </ol>

      <h3>Instance Properties</h3>
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Name</strong></td>
            <td>Descriptive name (e.g., &quot;Freshwater Pump 1&quot;).</td>
          </tr>
          <tr>
            <td><strong>Tag</strong></td>
            <td>Tag prefix used to generate signal tags (e.g., &quot;FW_Pump1&quot;).</td>
          </tr>
          <tr>
            <td><strong>Bus</strong></td>
            <td>The bus this device communicates on (for bus-connected devices).</td>
          </tr>
          <tr>
            <td><strong>Node Role</strong></td>
            <td>CLIENT or SERVER role on the bus.</td>
          </tr>
          <tr>
            <td><strong>Node Address</strong></td>
            <td>Bus node address (e.g., Modbus unit ID).</td>
          </tr>
          <tr>
            <td><strong>CAN ID Offset</strong></td>
            <td>For CAN-based devices, the offset added to component-defined CAN IDs to create unique IDs per instance.</td>
          </tr>
          <tr>
            <td><strong>Function Block Override</strong></td>
            <td>Override the component&apos;s default function block for this specific instance.</td>
          </tr>
          <tr>
            <td><strong>Byte Order</strong></td>
            <td>BIG_ENDIAN or LITTLE_ENDIAN for multi-byte bus data interpretation.</td>
          </tr>
        </tbody>
      </table>

      <h2>Instance Signals and Template Tracking</h2>
      <p>
        The <code>InstanceSignal</code> record is the bridge between a component signal
        template and the actual project signals. It tracks whether the signal still
        matches the template:
      </p>
      <ul>
        <li>
          <strong><code>templateDirty = false</code></strong> &mdash; The signal matches the component template
          defaults. If the template is updated, changes can be safely propagated to this signal.
        </li>
        <li>
          <strong><code>templateDirty = true</code></strong> &mdash; The signal has been manually edited
          and diverges from the template. Template updates will skip this signal, and
          a revert button is shown in the UI.
        </li>
      </ul>
      <p>
        One <code>InstanceSignal</code> can have multiple <code>Signal</code> rows attached,
        supporting redundant wiring scenarios where the same logical signal is connected
        to multiple physical channels.
      </p>

      <h2>Grouping Components</h2>
      <p>
        When you notice that several components share a common subset of signals, you
        can extract those signals into a parent component:
      </p>
      <ol>
        <li>Create a new parent component with the shared signals (e.g., &quot;Generic Pump&quot; with running/fault/temperature).</li>
        <li>Set the existing components as children of the new parent.</li>
        <li>Remove the duplicated signals from the child components (they now inherit from the parent).</li>
        <li>Keep only the signals that are unique to each child.</li>
      </ol>
      <p>
        This reduces maintenance effort: updating a shared signal on the parent
        automatically affects all child components and their instances.
      </p>

      <h2>PDO Configuration (CANopen)</h2>
      <p>
        For CANopen-based components, you can define <strong>PDO (Process Data Object)
        configurations</strong> that specify how signals are mapped into CAN frames:
      </p>
      <ul>
        <li><strong>Direction:</strong> TPDO (device transmits to PLC) or RPDO (PLC transmits to device).</li>
        <li><strong>PDO Number:</strong> 1&ndash;4, matching the CANopen PDO slots.</li>
        <li><strong>Transmission Type:</strong> 0&ndash;255 per the CANopen specification.</li>
        <li><strong>Event Timer / Inhibit Time:</strong> Communication timing parameters written to the device during commissioning.</li>
      </ul>
      <p>
        Component signals can be linked to a PDO configuration, establishing the
        mapping between logical signals and CAN frame positions.
      </p>
    </article>
  );
}

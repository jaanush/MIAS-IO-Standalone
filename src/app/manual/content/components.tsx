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

      <h2>Component Parameters</h2>
      <p>
        Beyond the signal set, a component template can declare <strong>parameters</strong> &mdash;
        per-instance configuration values that aren&apos;t themselves IO signals.
        Examples: a tank&apos;s maximum volume, the number of cells in a battery string,
        or a piecewise-linear calibration curve. Parameters are declared once on the
        template and supplied (or overridden) per instance.
      </p>
      <p>
        Parameters live on a dedicated <strong>Parameters</strong> tab inside a
        component (<code>/components/[id]/parameters</code>). Each declaration has:
      </p>
      <ul>
        <li><strong>Name</strong> &mdash; the unique key used to look up the value (e.g. <code>maxVolume_m3</code>). Cannot be changed after creation.</li>
        <li><strong>Type</strong> &mdash; one of <code>SCALAR_REAL</code>, <code>INT</code>, <code>STRING</code>, <code>BOOL</code>, or <code>CURVE</code>. Cannot be changed after creation; recreate the parameter if the type was wrong.</li>
        <li><strong>Required</strong> &mdash; if checked, an instance must specify a value (cannot inherit a NULL default).</li>
        <li><strong>Default</strong> &mdash; the value used when an instance doesn&apos;t override. Not applicable to <code>CURVE</code> parameters; curves are always per-instance.</li>
        <li><strong>Description</strong> &mdash; free-form text shown in the per-instance editor.</li>
      </ul>

      <h3>Per-instance values</h3>
      <p>
        Whenever an instance of a component is shown in the UI, an inline
        <strong>Parameters</strong> panel appears beneath it listing every declared
        parameter. The panel is visible in two places:
      </p>
      <ul>
        <li>The <em>Hardware</em> page, beneath the selected instance&apos;s detail panel.</li>
        <li>The project&apos;s <em>Components</em> page, where instances of a template expand inline.</li>
      </ul>
      <p>
        Each row uses the right control for its type: a number input for
        <code>SCALAR_REAL</code> / <code>INT</code>, text for <code>STRING</code>, a
        select for <code>BOOL</code>, and an <strong>Edit curve</strong> button for
        <code>CURVE</code>. Required parameters are marked with a red asterisk. When a
        cell is empty, the placeholder shows the template default and a small
        &quot;Using template default&quot; hint &mdash; the value is inherited until you
        type one.
      </p>

      <h3>The curve editor</h3>
      <p>
        Clicking <strong>Edit curve</strong> opens a reusable dialog with a point
        grid: each row is an (x, y) pair, and the rows are kept in entry order. You
        can re-order rows up or down, delete rows, or add new ones with
        <strong>Add row</strong>. The server enforces that <em>x</em> is strictly
        ascending; the dialog previews this and refuses to save until the violation
        is fixed.
      </p>
      <p>
        When the dialog is opened in a project context, a <strong>Live capture</strong>
        section appears above the grid. It lets you pick a monitored signal, watch
        its current reading update every two seconds, and click
        <strong>Capture &rarr; x</strong> to copy the live value into the next empty
        <em>x</em> cell. The capture defaults to <strong>RAW</strong> mode so you
        calibrate against the underlying sensor reading, not against an
        already-scaled value &mdash; see <em>Live Monitoring</em> for details on the
        SCALED/RAW split.
      </p>

      <h3>Worked example: Tank Sensor</h3>
      <p>
        A built-in global template named <strong>Tank Sensor</strong> demonstrates
        the pattern. Its function block is <code>FB_TankSensor</code> and it declares
        four parameters:
      </p>
      <ul>
        <li><code>maxVolume_m3</code> &mdash; SCALAR_REAL.</li>
        <li><code>sTag</code> &mdash; STRING.</li>
        <li><code>volumeCurve</code> &mdash; CURVE: raw sensor reading &rarr; volume.</li>
        <li><code>heightCurve</code> &mdash; CURVE: raw sensor reading &rarr; height.</li>
      </ul>
      <p>
        A typical site-calibration session: enable RAW monitoring on the level
        sensor, fill the tank to a known mark, open the tank-sensor instance&apos;s
        <code>volumeCurve</code> editor, click <strong>Capture &rarr; x</strong> to
        grab the raw reading, type the engineering volume as <em>y</em>, and repeat
        across the calibration range. The resulting <code>Curve</code> is reusable
        &mdash; the per-instance parameter holds a <code>curveId</code> reference, and
        you could point another instance&apos;s curve parameter at the same row.
      </p>

      <h2>Composite Components</h2>
      <p>
        Some devices are not a single physical unit but a composition of
        sub-components: a battery system contains 16 cells plus a BMS, a genset
        comprises an engine plus a generator, a propulsion line couples a motor with
        a VFD and a gearbox. Composite components let you model that structure
        directly.
      </p>
      <p>
        A <strong>HardwareComponent</strong> can be configured one of two ways
        &mdash; the choice is mutually exclusive on a given template, and the server
        enforces it:
      </p>
      <ul>
        <li>
          <strong>Inheritance</strong> &mdash; set a <code>parentId</code> and inherit signals
          from the parent. This is the existing single-inheritance model described above.
        </li>
        <li>
          <strong>Composition</strong> &mdash; declare <code>ComponentComposition</code> rows
          that name child components by role (e.g. <code>cell_01</code>, <code>cell_02</code>,
          <code>bms</code>). The composite has no signals of its own; instead, instantiating
          it stamps out one child instance per role.
        </li>
      </ul>

      <h3>Stamping a composite</h3>
      <p>
        When you instantiate a composite component, the server runs the
        <code>instanceStampComposite</code> action: it creates the parent
        <code>ComponentInstance</code> and then one child <code>ComponentInstance</code>
        per <code>ComponentComposition</code> row. Each child gets:
      </p>
      <ul>
        <li>A tag formed by appending the role to the parent tag in dot-style
          (<code>BATT_AFT.cell_01</code>, <code>GENSET_1.engine</code>).</li>
        <li>A populated <code>parentInstanceId</code> linking back to the composite parent.</li>
        <li>A <code>compositionRole</code> matching the role from the template.</li>
      </ul>
      <p>
        The dot-style naming is an intentional extension of the composite-FB-with-members
        pattern the plugin emits in CODESYS, so the IEC tags read naturally
        (<code>GVL_PMS.GENSET_1.engine</code>).
      </p>

      <h3>Wiring across composite children</h3>
      <p>
        A wiring recipe defined on the composite parent can address signals on its
        children using the <code>CHILD_SIGNAL</code> source type. You name a
        <code>child_role</code> and a <code>signal_tag</code> (the suffix of one of
        the child&apos;s component signals); the plugin walks to the matching child
        instance and resolves the parameter to that child&apos;s real signal tag at
        codegen time. See <em>Wiring Recipes</em> for the full source-type list.
      </p>

      <h3>Use cases</h3>
      <ul>
        <li><strong>Battery System</strong> &mdash; 16 cells (each with voltage / temperature signals) plus a BMS controller.</li>
        <li><strong>Genset</strong> &mdash; an engine and a generator, each with their own signal sets but operated together.</li>
        <li><strong>Propulsion</strong> &mdash; motor, VFD, and gearbox treated as a single propulsion unit at the operator level.</li>
      </ul>
    </article>
  );
}

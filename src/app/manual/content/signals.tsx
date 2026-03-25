export function SignalsSection() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <h1>Signals</h1>
      <p className="lead text-muted-foreground">
        Signals are the core data type in MIAS-IO. Every physical measurement, switch
        input, and control output in the automation system is represented as a signal
        bound to an IO card channel.
      </p>

      <h2>Signal Architecture</h2>
      <p>
        MIAS-IO uses <strong>vertical inheritance</strong> for signal types. There is a base
        <code>Signal</code> table containing fields common to all signals (tag, description,
        origin, direction, hardware binding). Each signal then has exactly one child
        record in either <code>DiscreteSignal</code> or <code>AnalogSignal</code>, which holds
        type-specific properties. This design is intentional and must not be merged
        into a single table.
      </p>

      {/* Signal type hierarchy diagram */}
      <div className="my-8 flex justify-center">
        <svg viewBox="0 0 660 280" className="w-full max-w-2xl" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="sig-arrow" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 3.5 L 0 7 z" className="fill-foreground" />
            </marker>
          </defs>

          {/* Base Signal */}
          <rect x="200" y="10" width="260" height="56" rx="8" className="fill-primary/15 stroke-primary" strokeWidth="1.5" />
          <text x="330" y="32" textAnchor="middle" className="fill-foreground font-medium" fontSize="13">Signal (base table)</text>
          <text x="330" y="50" textAnchor="middle" className="fill-muted-foreground" fontSize="10">tag, description, origin, direction, ioCardId, channelPosition</text>

          {/* Branch lines */}
          <line x1="330" y1="66" x2="330" y2="82" className="stroke-foreground/50" strokeWidth="1" />
          <line x1="170" y1="82" x2="490" y2="82" className="stroke-foreground/50" strokeWidth="1" />

          {/* Left branch: Discrete */}
          <line x1="170" y1="82" x2="170" y2="97" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#sig-arrow)" />
          <rect x="40" y="102" width="260" height="56" rx="8" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="170" y="124" textAnchor="middle" className="fill-foreground font-medium" fontSize="12">DiscreteSignal (1:1 child)</text>
          <text x="170" y="144" textAnchor="middle" className="fill-muted-foreground" fontSize="10">trigger, filterTimeMs, switchingType, signalVoltage</text>

          {/* Right branch: Analog */}
          <line x1="490" y1="82" x2="490" y2="97" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#sig-arrow)" />
          <rect x="360" y="102" width="260" height="56" rx="8" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="490" y="124" textAnchor="middle" className="fill-foreground font-medium" fontSize="12">AnalogSignal (1:1 child)</text>
          <text x="490" y="144" textAnchor="middle" className="fill-muted-foreground" fontSize="10">inputType, wireConfig, rawMin/Max, scaleMin/Max, EU</text>

          {/* Discrete signal subtypes */}
          <line x1="100" y1="158" x2="100" y2="178" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#sig-arrow)" />
          <rect x="20" y="183" width="160" height="36" rx="6" className="fill-muted/60 stroke-border" strokeWidth="1" />
          <text x="100" y="205" textAnchor="middle" className="fill-foreground" fontSize="11">DI (Digital Input)</text>

          <line x1="240" y1="158" x2="240" y2="178" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#sig-arrow)" />
          <rect x="160" y="183" width="160" height="36" rx="6" className="fill-muted/60 stroke-border" strokeWidth="1" />
          <text x="240" y="205" textAnchor="middle" className="fill-foreground" fontSize="11">DO (Digital Output)</text>

          {/* Analog signal subtypes */}
          <line x1="420" y1="158" x2="420" y2="178" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#sig-arrow)" />
          <rect x="340" y="183" width="160" height="36" rx="6" className="fill-muted/60 stroke-border" strokeWidth="1" />
          <text x="420" y="205" textAnchor="middle" className="fill-foreground" fontSize="11">AI (Analog Input)</text>

          <line x1="560" y1="158" x2="560" y2="178" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#sig-arrow)" />
          <rect x="480" y="183" width="160" height="36" rx="6" className="fill-muted/60 stroke-border" strokeWidth="1" />
          <text x="560" y="205" textAnchor="middle" className="fill-foreground" fontSize="11">AO (Analog Output)</text>

          {/* Alarm branches */}
          <line x1="100" y1="219" x2="100" y2="235" className="stroke-foreground/50" strokeWidth="1" />
          <rect x="30" y="238" width="140" height="28" rx="4" className="fill-destructive/10 stroke-destructive/50" strokeWidth="1" />
          <text x="100" y="256" textAnchor="middle" className="fill-foreground" fontSize="10">DiscreteAlarm</text>

          <line x1="420" y1="219" x2="420" y2="235" className="stroke-foreground/50" strokeWidth="1" />
          <rect x="350" y="238" width="140" height="28" rx="4" className="fill-destructive/10 stroke-destructive/50" strokeWidth="1" />
          <text x="420" y="256" textAnchor="middle" className="fill-foreground" fontSize="10">AnalogAlarm</text>
        </svg>
      </div>

      <h2>Signal Properties (Base)</h2>
      <p>
        All signals share these common properties on the base <code>Signal</code> table:
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
            <td><strong>Tag</strong></td>
            <td>The signal&apos;s unique identifier within the project (e.g., &quot;ER_FW_Pump1_Running&quot;). Used as the CODESYS variable name.</td>
          </tr>
          <tr>
            <td><strong>Tag Suffix</strong></td>
            <td>Optional suffix appended to the component tag when the signal is generated from a component instance.</td>
          </tr>
          <tr>
            <td><strong>Description</strong></td>
            <td>Human-readable description of what the signal represents.</td>
          </tr>
          <tr>
            <td><strong>Signal Type</strong></td>
            <td>DISCRETE or ANALOG. Determines which child table (DiscreteSignal or AnalogSignal) holds the type-specific data.</td>
          </tr>
          <tr>
            <td><strong>Direction</strong></td>
            <td>INPUT or OUTPUT from the PLC&apos;s perspective.</td>
          </tr>
          <tr>
            <td><strong>Origin</strong></td>
            <td>How the signal reaches the PLC: IEC (hardwired), MODBUS_RTU, MODBUS_TCP, CANBUS, CANOPEN, J1939, PROFIBUS, PROFINET, ETHERNETIP, DEVICENET, BACNET, or INTERNAL.</td>
          </tr>
          <tr>
            <td><strong>IO Card</strong></td>
            <td>The IO card this signal is bound to (nullable for unbound signals).</td>
          </tr>
          <tr>
            <td><strong>Channel Position</strong></td>
            <td>The channel number on the IO card (0-based or 1-based depending on the module).</td>
          </tr>
          <tr>
            <td><strong>System</strong></td>
            <td>The functional system this signal belongs to (e.g., &quot;Cooling Water&quot;, &quot;Fuel System&quot;).</td>
          </tr>
          <tr>
            <td><strong>GVL</strong></td>
            <td>Which Global Variable List this signal should be generated into in CODESYS.</td>
          </tr>
          <tr>
            <td><strong>Component Tag</strong></td>
            <td>The tag of the device/component this signal belongs to (for ISA instrument identification).</td>
          </tr>
          <tr>
            <td><strong>Drawing Ref</strong></td>
            <td>Reference to the electrical drawing where this signal appears.</td>
          </tr>
          <tr>
            <td><strong>Revision</strong></td>
            <td>The project revision when this signal was last modified.</td>
          </tr>
        </tbody>
      </table>

      <h2>Hardware Binding</h2>
      <p>
        A signal&apos;s physical location is defined by binding it to an IO card and channel:
      </p>
      <ol>
        <li>The signal&apos;s <code>ioCardId</code> points to a specific IO card.</li>
        <li>The signal&apos;s <code>channelPosition</code> identifies which channel on that card.</li>
        <li>The combination of <code>(ioCardId, channelPosition)</code> is unique &mdash; no two signals can occupy the same channel.</li>
      </ol>
      <p>
        In addition to the live FK binding, signals store stable hardware identifier
        fields (<code>hwCabinet</code>, <code>hwCarrier</code>, <code>hwTypeCode</code>, <code>hwInstance</code>)
        that survive card deletion. This allows signal lists and documents to reference
        the hardware location even after the physical card has been removed from the
        configuration.
      </p>

      <h2>Discrete Signals</h2>
      <p>
        Discrete signals represent binary (on/off) values. They are used for switches,
        relays, digital sensors, and contact-based inputs/outputs. The <code>DiscreteSignal</code>
        child table adds:
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
            <td><strong>Trigger</strong></td>
            <td>NO (Normally Open) or NC (Normally Closed). Determines the resting state of the contact.</td>
          </tr>
          <tr>
            <td><strong>Filter Time (ms)</strong></td>
            <td>Debounce time in milliseconds. The signal must remain stable for this duration before a state change is registered.</td>
          </tr>
          <tr>
            <td><strong>Switching Type</strong></td>
            <td>HIGH_SIDE, LOW_SIDE, or BOTH. Indicates the electrical switching topology for outputs.</td>
          </tr>
          <tr>
            <td><strong>Signal Voltage</strong></td>
            <td>The nominal voltage level of the signal (e.g., &quot;24VDC&quot;).</td>
          </tr>
        </tbody>
      </table>

      <h2>Analog Signals</h2>
      <p>
        Analog signals represent continuous values such as temperature, pressure, flow
        rate, and level. The <code>AnalogSignal</code> child table adds:
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
            <td><strong>Input Type</strong></td>
            <td>The electrical input type from the catalog (e.g., &quot;4-20mA&quot;, &quot;0-10V&quot;, &quot;PT100&quot;, &quot;Thermocouple K&quot;).</td>
          </tr>
          <tr>
            <td><strong>Wire Config</strong></td>
            <td>TWO_WIRE, THREE_WIRE, or FOUR_WIRE. Defines the wiring topology for resistance-based sensors.</td>
          </tr>
          <tr>
            <td><strong>Raw Min / Max</strong></td>
            <td>The raw ADC value range (e.g., 0&ndash;32767 for a 15-bit converter, or 4.0&ndash;20.0 for mA).</td>
          </tr>
          <tr>
            <td><strong>Scale Min / Max</strong></td>
            <td>The engineering unit range (e.g., 0&ndash;100 &deg;C). The PLC scales raw values into this range.</td>
          </tr>
          <tr>
            <td><strong>Clamp Low / High</strong></td>
            <td>Output clamping limits. The scaled value is clamped to this range in the PLC program.</td>
          </tr>
          <tr>
            <td><strong>Deadband</strong></td>
            <td>Minimum change required before the value is considered to have changed. Reduces noise in the PLC program.</td>
          </tr>
          <tr>
            <td><strong>Engineering Unit</strong></td>
            <td>The unit of measurement (e.g., &deg;C, bar, m&sup3;/h). Selected from the global engineering unit catalog.</td>
          </tr>
        </tbody>
      </table>

      <h3>Sensor Failure Detection</h3>
      <p>
        Analog signals support configurable sensor failure detection. When enabled,
        the PLC monitors the raw signal value for conditions that indicate a broken
        sensor or wiring fault:
      </p>
      <ul>
        <li><strong>Wire Break Detection</strong> &mdash; Detects open-circuit conditions (e.g., 4-20mA signal drops below 3.6mA).</li>
        <li><strong>Short Circuit Detection</strong> &mdash; Detects short-circuit conditions on the sensor wiring.</li>
        <li><strong>Out of Range Detection</strong> &mdash; Detects values outside the expected raw range.</li>
        <li><strong>NAMUR NE 43</strong> &mdash; Applies NAMUR NE 43 standard failure detection ranges for 4-20mA signals (3.8&ndash;20.5mA valid, outside = fault).</li>
      </ul>

      <h2>Alarm Configuration</h2>
      <p>
        Both discrete and analog signals can have alarm definitions attached. Alarms
        are stored in separate tables by type, enforced by foreign key constraints.
      </p>

      <h3>Discrete Alarms</h3>
      <p>
        A discrete alarm triggers when the signal matches a specific condition:
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
            <td><strong>Condition</strong></td>
            <td>ON_TRIGGER (alarm when signal goes active) or OFF_TRIGGER (alarm when signal goes inactive).</td>
          </tr>
          <tr>
            <td><strong>Severity</strong></td>
            <td>INFO, WARNING, ALARM, or CRITICAL.</td>
          </tr>
          <tr>
            <td><strong>Alarm Group</strong></td>
            <td>Priority tier (A, B, or C) used by the METS_Lib alarm system.</td>
          </tr>
          <tr>
            <td><strong>Delay (seconds)</strong></td>
            <td>Time the condition must persist before the alarm activates.</td>
          </tr>
          <tr>
            <td><strong>Message</strong></td>
            <td>The alarm text displayed to operators.</td>
          </tr>
        </tbody>
      </table>

      <h3>Analog Alarms</h3>
      <p>
        Analog alarms trigger when the scaled value crosses a setpoint threshold:
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
            <td><strong>Condition</strong></td>
            <td>HIGH, HIGH_HIGH, LOW, or LOW_LOW. Multiple alarms can exist on the same signal with different conditions.</td>
          </tr>
          <tr>
            <td><strong>Setpoint</strong></td>
            <td>The threshold value in engineering units.</td>
          </tr>
          <tr>
            <td><strong>Hysteresis</strong></td>
            <td>Deadband around the setpoint to prevent alarm chatter.</td>
          </tr>
          <tr>
            <td><strong>Severity</strong></td>
            <td>INFO, WARNING, ALARM, or CRITICAL.</td>
          </tr>
          <tr>
            <td><strong>Alarm Group</strong></td>
            <td>Priority tier (A, B, or C).</td>
          </tr>
          <tr>
            <td><strong>Delay (seconds)</strong></td>
            <td>Time the threshold must be exceeded before the alarm activates.</td>
          </tr>
          <tr>
            <td><strong>Message</strong></td>
            <td>The alarm text displayed to operators.</td>
          </tr>
        </tbody>
      </table>

      <h2>Signal Origins</h2>
      <p>
        The <code>origin</code> field determines how a signal reaches the PLC:
      </p>
      <table>
        <thead>
          <tr>
            <th>Origin</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>IEC</strong></td>
            <td>Hardwired to an IO card channel (IEC 61131-3 standard IO). This is the default and most common origin.</td>
          </tr>
          <tr>
            <td><strong>MODBUS_RTU / MODBUS_TCP</strong></td>
            <td>Read from a Modbus device via serial or TCP. Additional addressing in BusSignal: unit ID, register type, register offset.</td>
          </tr>
          <tr>
            <td><strong>CANBUS / CANOPEN / J1939</strong></td>
            <td>Received via CAN bus protocol. Additional addressing: CAN ID, node ID, bit offset/length, PDO index.</td>
          </tr>
          <tr>
            <td><strong>PROFIBUS / PROFINET</strong></td>
            <td>Process fieldbus signals. Address mapping handled at the bus level.</td>
          </tr>
          <tr>
            <td><strong>ETHERNETIP / BACNET / DEVICENET</strong></td>
            <td>Other industrial Ethernet and fieldbus protocols.</td>
          </tr>
          <tr>
            <td><strong>INTERNAL</strong></td>
            <td>PLC-internal variable, not connected to any physical IO. Used for calculated values and software signals.</td>
          </tr>
        </tbody>
      </table>
      <p>
        For non-IEC signals, additional bus-specific addressing is stored in
        the <code>BusSignal</code> child table (1:1 relationship with Signal).
      </p>

      <h2>Inline Editing</h2>
      <p>
        The signals table supports inline editing &mdash; click on any editable cell to
        modify the value directly in the table. Changes are saved automatically when
        you move to another cell or press Enter. Cells that support inline editing
        show a subtle hover indicator.
      </p>
      <p>
        For more complex edits (alarm configuration, detailed analog properties),
        click the signal row to open the full signal detail panel.
      </p>

      <h2>Bulk Operations</h2>
      <p>
        The signals table supports multi-select for bulk operations:
      </p>
      <ul>
        <li><strong>Select</strong> &mdash; Use checkboxes or Shift+click to select multiple signals.</li>
        <li><strong>Bulk Edit</strong> &mdash; Apply the same value to a field across all selected signals (e.g., set all to the same system or GVL).</li>
        <li><strong>Bulk Delete</strong> &mdash; Delete all selected signals in one operation.</li>
      </ul>

      <h2>Code Generation Fields</h2>
      <p>
        Several signal fields control how CODESYS code is generated:
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
            <td><strong>isRetain</strong></td>
            <td>Generate as <code>VAR_GLOBAL RETAIN</code> &mdash; value survives power cycles.</td>
          </tr>
          <tr>
            <td><strong>isPersistent</strong></td>
            <td>Generate as <code>VAR_GLOBAL PERSISTENT</code> &mdash; value survives firmware updates.</td>
          </tr>
          <tr>
            <td><strong>loggingEnabled</strong></td>
            <td>Generate an <code>AnyConversion()</code> logging call for this signal.</td>
          </tr>
          <tr>
            <td><strong>fbNameOverride</strong></td>
            <td>Override the auto-generated function block tag prefix.</td>
          </tr>
          <tr>
            <td><strong>useShortName</strong></td>
            <td>Use shortened System_Component naming instead of the full hardware path.</td>
          </tr>
          <tr>
            <td><strong>Alarm Block Mask</strong></td>
            <td>5-character mask (D-HH-H-L-LL) controlling which alarms are active. &quot;0&quot; = active, &quot;1&quot; = blocked.</td>
          </tr>
          <tr>
            <td><strong>FAT Block</strong></td>
            <td>Block all alarms during Factory Acceptance Testing phase.</td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}

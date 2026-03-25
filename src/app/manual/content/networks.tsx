export function NetworksSection() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <h1>Networks &amp; Buses</h1>
      <p className="lead text-muted-foreground">
        MIAS-IO separates communication infrastructure into two layers: IP Networks
        (Ethernet infrastructure) and Buses (fieldbus protocols). This reflects the
        real-world distinction between physical network cabling and the protocols
        running on top of it.
      </p>

      <h2>Network Model</h2>

      {/* Network model diagram */}
      <div className="my-8 flex justify-center">
        <svg viewBox="0 0 700 380" className="w-full max-w-2xl" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="net-arrow" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 3.5 L 0 7 z" className="fill-foreground" />
            </marker>
          </defs>

          {/* IP Network layer */}
          <rect x="30" y="10" width="640" height="80" rx="10" className="fill-primary/8 stroke-primary/40" strokeWidth="1.5" strokeDasharray="6 3" />
          <text x="50" y="32" className="fill-primary font-medium" fontSize="12">IP Network: &quot;Engine Room LAN&quot; (192.168.1.0/24)</text>

          {/* Bus 1: Modbus TCP */}
          <rect x="50" y="50" width="200" height="30" rx="6" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="150" y="70" textAnchor="middle" className="fill-foreground" fontSize="11">Bus: Modbus TCP</text>

          {/* Bus 2: PROFINET */}
          <rect x="280" y="50" width="200" height="30" rx="6" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="380" y="70" textAnchor="middle" className="fill-foreground" fontSize="11">Bus: PROFINET</text>

          {/* Standalone Bus: Modbus RTU (no IP) */}
          <rect x="510" y="110" width="170" height="30" rx="6" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="595" y="130" textAnchor="middle" className="fill-foreground" fontSize="11">Bus: Modbus RTU</text>
          <text x="595" y="150" textAnchor="middle" className="fill-muted-foreground" fontSize="9">(serial, no IP network)</text>

          {/* Lines from buses to nodes */}
          <line x1="100" y1="80" x2="100" y2="170" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#net-arrow)" />
          <line x1="200" y1="80" x2="200" y2="170" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#net-arrow)" />
          <line x1="380" y1="80" x2="380" y2="170" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#net-arrow)" />
          <line x1="595" y1="155" x2="595" y2="170" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#net-arrow)" />

          {/* BusNode labels */}
          <text x="100" y="165" textAnchor="middle" className="fill-muted-foreground" fontSize="8">BusNode</text>
          <text x="200" y="165" textAnchor="middle" className="fill-muted-foreground" fontSize="8">BusNode</text>
          <text x="380" y="165" textAnchor="middle" className="fill-muted-foreground" fontSize="8">BusNode</text>
          <text x="595" y="167" textAnchor="middle" className="fill-muted-foreground" fontSize="8">BusNode</text>

          {/* Devices */}
          <rect x="30" y="175" width="140" height="50" rx="8" className="fill-primary/15 stroke-primary" strokeWidth="1.5" />
          <text x="100" y="197" textAnchor="middle" className="fill-foreground font-medium" fontSize="11">PLC-01</text>
          <text x="100" y="213" textAnchor="middle" className="fill-muted-foreground" fontSize="9">192.168.1.10 (SERVER)</text>

          <rect x="130" y="175" width="140" height="50" rx="8" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="200" y="197" textAnchor="middle" className="fill-foreground font-medium" fontSize="11">Carrier N3:D01</text>
          <text x="200" y="213" textAnchor="middle" className="fill-muted-foreground" fontSize="9">192.168.1.20 (CLIENT)</text>

          <rect x="310" y="175" width="140" height="50" rx="8" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="380" y="197" textAnchor="middle" className="fill-foreground font-medium" fontSize="11">Carrier N3:D02</text>
          <text x="380" y="213" textAnchor="middle" className="fill-muted-foreground" fontSize="9">192.168.1.30 (CLIENT)</text>

          <rect x="525" y="175" width="140" height="50" rx="8" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="595" y="197" textAnchor="middle" className="fill-foreground font-medium" fontSize="11">Serial Device</text>
          <text x="595" y="213" textAnchor="middle" className="fill-muted-foreground" fontSize="9">Addr 1 (via IO card)</text>

          {/* CAN bus example with instances */}
          <rect x="30" y="260" width="300" height="30" rx="6" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="180" y="280" textAnchor="middle" className="fill-foreground" fontSize="11">Bus: CANopen (hosted by serial card, slot 5)</text>

          <line x1="100" y1="290" x2="100" y2="310" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#net-arrow)" />
          <line x1="260" y1="290" x2="260" y2="310" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#net-arrow)" />

          <rect x="30" y="315" width="140" height="45" rx="8" className="fill-primary/10 stroke-primary/60" strokeWidth="1" />
          <text x="100" y="335" textAnchor="middle" className="fill-foreground" fontSize="10">Instance: Pump VFC1</text>
          <text x="100" y="350" textAnchor="middle" className="fill-muted-foreground" fontSize="9">CAN ID offset: 0x100</text>

          <rect x="190" y="315" width="140" height="45" rx="8" className="fill-primary/10 stroke-primary/60" strokeWidth="1" />
          <text x="260" y="335" textAnchor="middle" className="fill-foreground" fontSize="10">Instance: Pump VFC2</text>
          <text x="260" y="350" textAnchor="middle" className="fill-muted-foreground" fontSize="9">CAN ID offset: 0x200</text>

          {/* Legend */}
          <rect x="370" y="270" width="300" height="90" rx="8" className="fill-muted/30 stroke-border" strokeWidth="1" strokeDasharray="4 2" />
          <text x="390" y="290" className="fill-muted-foreground font-medium" fontSize="10">Legend</text>
          <rect x="390" y="298" width="12" height="12" rx="2" className="fill-primary/15 stroke-primary" strokeWidth="1" />
          <text x="410" y="309" className="fill-muted-foreground" fontSize="9">PLC / Component Instance</text>
          <rect x="390" y="316" width="12" height="12" rx="2" className="fill-muted stroke-border" strokeWidth="1" />
          <text x="410" y="327" className="fill-muted-foreground" fontSize="9">Carrier / Device</text>
          <rect x="390" y="334" width="12" height="12" rx="2" className="fill-primary/8 stroke-primary/40" strokeWidth="1" />
          <text x="410" y="345" className="fill-muted-foreground" fontSize="9">IP Network (dashed = layer)</text>
        </svg>
      </div>

      <h2>IP Networks</h2>
      <p>
        An <strong>IpNetwork</strong> represents a physical Ethernet network segment. It
        models the Layer 3 infrastructure that buses and devices communicate over.
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
            <td><strong>Name</strong></td>
            <td>A descriptive label (e.g., &quot;Engine Room LAN&quot;, &quot;Bridge Network&quot;).</td>
          </tr>
          <tr>
            <td><strong>Subnet</strong></td>
            <td>CIDR notation (e.g., &quot;192.168.1.0/24&quot;).</td>
          </tr>
          <tr>
            <td><strong>Gateway</strong></td>
            <td>Optional default gateway address.</td>
          </tr>
          <tr>
            <td><strong>DNS</strong></td>
            <td>Optional DNS servers (comma-separated).</td>
          </tr>
          <tr>
            <td><strong>Description</strong></td>
            <td>Additional notes about the network.</td>
          </tr>
        </tbody>
      </table>
      <p>
        IP Networks are created at the project level and can be referenced by:
      </p>
      <ul>
        <li><strong>PLC Ports</strong> &mdash; Assign a PLC Ethernet port to a specific IP network.</li>
        <li><strong>Carrier Ports</strong> &mdash; Assign a carrier Ethernet port to an IP network.</li>
        <li><strong>Buses</strong> &mdash; Ethernet-based buses (Modbus TCP, PROFINET, EtherNet/IP, BACnet, EtherCAT) reference the IP network they run over.</li>
      </ul>

      <h2>Buses</h2>
      <p>
        A <strong>Bus</strong> represents a fieldbus or network-based communication protocol
        connecting devices to the PLC. Buses carry the actual signal data.
      </p>

      <h3>Bus Properties</h3>
      <table>
        <thead>
          <tr>
            <th>Field</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Protocol</strong></td>
            <td>The bus protocol (see protocol categories below).</td>
          </tr>
          <tr>
            <td><strong>Role</strong></td>
            <td>MASTER, SLAVE, ADAPTER, or SCANNER &mdash; the PLC&apos;s role on this bus.</td>
          </tr>
          <tr>
            <td><strong>IP Network</strong></td>
            <td>For Ethernet-based buses, the IP network this bus runs over.</td>
          </tr>
          <tr>
            <td><strong>IO Card</strong></td>
            <td>If the bus is hosted by a specific IO card (e.g., a serial communication module), this references that card.</td>
          </tr>
          <tr>
            <td><strong>Description</strong></td>
            <td>A descriptive label for the bus.</td>
          </tr>
          <tr>
            <td><strong>Cycle Period (ms)</strong></td>
            <td>The polling or cycle time for this bus.</td>
          </tr>
        </tbody>
      </table>

      <h3>Protocol Categories</h3>
      <p>
        Bus protocols are grouped by their physical transport layer:
      </p>
      <table>
        <thead>
          <tr>
            <th>Category</th>
            <th>Protocols</th>
            <th>Key Properties</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>Ethernet-based</strong></td>
            <td>MODBUS_TCP, PROFINET, ETHERNETIP, BACNET, ETHERCAT</td>
            <td>Requires IP Network assignment. Buses have ipAddress and ipPort fields.</td>
          </tr>
          <tr>
            <td><strong>Serial</strong></td>
            <td>MODBUS_RTU, PROFIBUS, INTERBUS, CC_LINK</td>
            <td>Uses baud rate, parity, stop bits. Often hosted by a serial IO card. Has node address for bus-level addressing.</td>
          </tr>
          <tr>
            <td><strong>Direct CAN</strong></td>
            <td>CANBUS, CANOPEN, J1939, DEVICENET</td>
            <td>Uses CAN-specific parameters: mode, heartbeat, sync period. Hosted by a CAN interface IO card. IO_LINK is also in this group.</td>
          </tr>
        </tbody>
      </table>

      <h3>Protocol-Specific Parameters</h3>
      <h4>Serial / Fieldbus (MODBUS_RTU, PROFIBUS)</h4>
      <ul>
        <li><strong>Baud Rate (kbit / bps)</strong> &mdash; Communication speed.</li>
        <li><strong>Parity</strong> &mdash; NONE, EVEN, or ODD.</li>
        <li><strong>Stop Bits</strong> &mdash; 1 or 2.</li>
      </ul>

      <h4>Ethernet / TCP (MODBUS_TCP, PROFINET, ETHERNETIP, BACNET)</h4>
      <ul>
        <li><strong>IP Address</strong> &mdash; The bus master/server IP.</li>
        <li><strong>IP Port</strong> &mdash; The TCP/UDP port number (e.g., 502 for Modbus TCP).</li>
      </ul>

      <h4>CAN (CANBUS, CANOPEN, J1939, DEVICENET)</h4>
      <ul>
        <li><strong>CAN Mode</strong> &mdash; TRANSPARENT, MAPPED, or SNIFFER.</li>
        <li><strong>Heartbeat (ms)</strong> &mdash; CANopen heartbeat period.</li>
        <li><strong>Sync Period (ms)</strong> &mdash; CANopen SYNC message interval.</li>
      </ul>

      <h2>Bus Nodes</h2>
      <p>
        A <strong>BusNode</strong> is a join table that records which devices participate on
        a bus. Each node entry connects either a PLC or a carrier to a bus with a
        specific role and address:
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
            <td><strong>Bus</strong></td>
            <td>The bus this node belongs to.</td>
          </tr>
          <tr>
            <td><strong>PLC or Carrier</strong></td>
            <td>The device on this bus (exactly one must be set).</td>
          </tr>
          <tr>
            <td><strong>Role</strong></td>
            <td>CLIENT or SERVER on the bus.</td>
          </tr>
          <tr>
            <td><strong>Node Address</strong></td>
            <td>Protocol-specific address (e.g., Modbus unit ID, PROFIBUS station address).</td>
          </tr>
          <tr>
            <td><strong>IP Address</strong></td>
            <td>Node-specific IP address for Ethernet-based buses.</td>
          </tr>
        </tbody>
      </table>
      <p>
        The combination of <code>(busId, plcId)</code> and <code>(busId, carrierId)</code> is
        unique &mdash; each device can appear only once on each bus.
      </p>

      <h2>Port Configuration</h2>
      <p>
        PLCs and carriers with multiple Ethernet ports use <strong>PlcPort</strong> and
        <strong>CarrierPort</strong> records to configure each port independently:
      </p>
      <ul>
        <li>Each port can have its own IP address.</li>
        <li>Each port can be assigned to a different IP Network.</li>
        <li>The number of available ports is determined by the device catalog entry&apos;s <code>ethernetPorts</code> field.</li>
      </ul>
      <p>
        This allows a PLC to have one port on the control network and another on a
        separate diagnostic or HMI network.
      </p>

      <h2>CAN-Specific Features</h2>

      <h3>CAN ID Offset</h3>
      <p>
        When multiple instances of the same CANopen component are on the same bus,
        each instance needs unique CAN IDs. The <strong>canIdOffset</strong> field on
        ComponentInstance shifts all CAN IDs defined in the component template by a
        fixed offset:
      </p>
      <p>
        For example, if a component defines signals at CAN IDs 0x180, 0x200, and 0x280,
        and an instance has <code>canIdOffset = 0x100</code>, the actual CAN IDs become
        0x280, 0x300, and 0x380.
      </p>

      <h3>CAN ID Span Visualization</h3>
      <p>
        The bus detail view shows a visual representation of CAN ID space usage across
        all instances on the bus. This helps identify conflicts and plan CAN ID
        allocation before commissioning.
      </p>

      <h2>Bus Hosting</h2>
      <p>
        A bus can be <strong>hosted by an IO card</strong> when the bus runs through a
        specific communication module rather than the PLC&apos;s built-in ports. For example:
      </p>
      <ul>
        <li>A WAGO 750-658 CAN interface card hosts a CANBUS or CANOPEN bus.</li>
        <li>A WAGO 750-652 RS-485 card hosts a MODBUS_RTU bus.</li>
      </ul>
      <p>
        When <code>bus.ioCardId</code> is set, the bus is associated with that IO card.
        The card must have <code>providesNetwork = true</code> in the module catalog.
        When <code>bus.ioCardId</code> is NULL, the bus is hosted by the PLC CPU directly.
      </p>
    </article>
  );
}

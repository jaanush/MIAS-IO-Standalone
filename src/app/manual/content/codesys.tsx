export function CodesysSection() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <h1>CODESYS Integration</h1>
      <p className="lead text-muted-foreground">
        MIAS-IO provides a REST API that the CODESYS plugin consumes to generate
        Global Variable Lists (GVLs), hardware device trees, IO channel mappings,
        and function block wiring directly inside a CODESYS project.
      </p>

      <h2>Architecture Overview</h2>
      <p>
        The integration uses a client-server model. MIAS-IO is the server (source of truth
        for all configuration data). The CODESYS plugin is the client, running inside
        the CODESYS IDE as an IronPython script that periodically polls the MIAS-IO API.
      </p>

      {/* Integration architecture diagram */}
      <div className="my-8 flex justify-center">
        <svg viewBox="0 0 700 250" className="w-full max-w-2xl" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="cds-arrow" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 3.5 L 0 7 z" className="fill-foreground" />
            </marker>
          </defs>

          {/* MIAS-IO Server */}
          <rect x="20" y="30" width="260" height="180" rx="10" className="fill-primary/8 stroke-primary/40" strokeWidth="1.5" />
          <text x="150" y="55" textAnchor="middle" className="fill-primary font-medium" fontSize="13">MIAS-IO Server</text>

          <rect x="40" y="70" width="220" height="30" rx="6" className="fill-muted stroke-border" strokeWidth="1" />
          <text x="150" y="90" textAnchor="middle" className="fill-foreground" fontSize="11">PostgreSQL Database</text>

          <rect x="40" y="110" width="220" height="30" rx="6" className="fill-muted stroke-border" strokeWidth="1" />
          <text x="150" y="130" textAnchor="middle" className="fill-foreground" fontSize="11">Next.js API Routes</text>

          <rect x="40" y="150" width="220" height="30" rx="6" className="fill-muted stroke-border" strokeWidth="1" />
          <text x="150" y="170" textAnchor="middle" className="fill-foreground" fontSize="11">REST API (/api/codesys/*)</text>

          {/* Arrows */}
          <line x1="280" y1="90" x2="400" y2="90" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#cds-arrow)" />
          <text x="340" y="83" textAnchor="middle" className="fill-muted-foreground" fontSize="9">JSON over HTTPS</text>
          <text x="340" y="103" textAnchor="middle" className="fill-muted-foreground" fontSize="9">X-API-Key header</text>

          <line x1="400" y1="140" x2="280" y2="140" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#cds-arrow)" />
          <text x="340" y="133" textAnchor="middle" className="fill-muted-foreground" fontSize="9">Task results</text>
          <text x="340" y="153" textAnchor="middle" className="fill-muted-foreground" fontSize="9">Heartbeat / session</text>

          {/* CODESYS Plugin */}
          <rect x="405" y="30" width="275" height="180" rx="10" className="fill-primary/8 stroke-primary/40" strokeWidth="1.5" />
          <text x="542" y="55" textAnchor="middle" className="fill-primary font-medium" fontSize="13">CODESYS IDE + Plugin</text>

          <rect x="425" y="70" width="235" height="30" rx="6" className="fill-muted stroke-border" strokeWidth="1" />
          <text x="542" y="90" textAnchor="middle" className="fill-foreground" fontSize="11">IronPython Scripts</text>

          <rect x="425" y="110" width="235" height="30" rx="6" className="fill-muted stroke-border" strokeWidth="1" />
          <text x="542" y="130" textAnchor="middle" className="fill-foreground" fontSize="11">GVL / HW Config Generator</text>

          <rect x="425" y="150" width="235" height="30" rx="6" className="fill-muted stroke-border" strokeWidth="1" />
          <text x="542" y="170" textAnchor="middle" className="fill-foreground" fontSize="11">CODESYS Project (.project)</text>
        </svg>
      </div>

      <h2>API Authentication</h2>
      <p>
        All CODESYS API endpoints require authentication via the <code>X-API-Key</code>
        HTTP header. The API key is configured in two places:
      </p>
      <ul>
        <li><strong>Server side:</strong> Set <code>CODESYS_API_KEY</code> in the MIAS-IO environment variables (<code>.env.local</code> for development).</li>
        <li><strong>Client side:</strong> Set the same key in the CODESYS plugin&apos;s <code>config.ini</code> file (git-ignored for security).</li>
      </ul>
      <p>
        Requests without a valid API key receive a <code>401 Unauthorized</code> response.
      </p>

      <h2>Session Management</h2>
      <p>
        The CODESYS plugin maintains a <strong>session</strong> with the MIAS-IO server.
        When the plugin starts, it registers a session containing:
      </p>
      <ul>
        <li>The user&apos;s email address and hostname.</li>
        <li>Plugin version.</li>
        <li>The MIAS-IO project ID being worked on.</li>
        <li>The local CODESYS project file path.</li>
      </ul>
      <p>
        The plugin sends periodic heartbeats to keep the session alive. The MIAS-IO
        web UI shows a <strong>CODESYS indicator</strong> in the header that displays
        active sessions &mdash; letting team members see who has the project open in CODESYS.
      </p>

      <h2>GVL Generation</h2>
      <p>
        <strong>Global Variable Lists (GVLs)</strong> are CODESYS containers for signal
        variables. MIAS-IO organizes signals into GVLs based on the <code>gvlId</code>
        field on each signal. The CODESYS plugin reads the GVL assignments and generates
        the corresponding variable declarations.
      </p>

      <h3>Generation Modes</h3>
      <table>
        <thead>
          <tr>
            <th>Mode</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>FLAT_VARS</strong></td>
            <td>Each signal becomes a standalone <code>VAR_GLOBAL</code> declaration. Simple and direct.</td>
          </tr>
          <tr>
            <td><strong>FB_INSTANCES</strong></td>
            <td>Signals are grouped into function block instances. More structured, supports component-based FB wiring.</td>
          </tr>
        </tbody>
      </table>

      <h3>Variable Naming</h3>
      <p>
        The signal&apos;s <code>tag</code> field becomes the CODESYS variable name. Tags should
        follow PLC naming conventions (no spaces, no special characters except underscore).
        The GVL name provides the namespace, so the full variable reference in CODESYS
        becomes <code>GVL_Name.SignalTag</code>.
      </p>

      <h3>Variable Attributes</h3>
      <p>
        Signals with <code>isRetain = true</code> are generated as <code>VAR_GLOBAL RETAIN</code>,
        meaning their values survive PLC power cycles. Signals with <code>isPersistent = true</code>
        are generated as <code>VAR_GLOBAL PERSISTENT</code>, surviving even firmware updates.
      </p>

      <h2>Hardware Configuration Export</h2>
      <p>
        The CODESYS plugin can synchronize the MIAS-IO hardware tree into the CODESYS
        device tree. This includes:
      </p>
      <ul>
        <li><strong>PLC device</strong> &mdash; The controller with its CODESYS device ID from the catalog.</li>
        <li><strong>Remote carriers</strong> &mdash; Fieldbus couplers added as sub-devices, with their CODESYS device ID and Modbus base addresses.</li>
        <li><strong>IO modules</strong> &mdash; Cards added to each carrier in slot order, using the CODESYS module ID from the module catalog.</li>
      </ul>
      <p>
        Local bus carriers (the PLC&apos;s built-in Kbus) are excluded from the remote
        device synchronization &mdash; they are configured directly on the PLC device
        in CODESYS.
      </p>

      <h3>IO Channel Mapping</h3>
      <p>
        For each signal bound to an IO card channel, the plugin generates the IO
        mapping that connects the CODESYS variable to the physical channel address.
        The <code>plcAddress</code> is computed server-side from the slot position and
        channel position, following WAGO-specific addressing rules.
      </p>

      <h3>Card Naming</h3>
      <p>
        Card names emitted by the API zero-pad the slot to two digits, e.g.
        <code>750-658_S02</code> rather than <code>_S2</code>. This is purely cosmetic
        but means lexical sort order matches slot order across the whole project.
      </p>

      <h3>Module variants (Kbus image size)</h3>
      <p>
        A few WAGO modules ship as multiple CODESYS device variants that share one
        article number but differ in process-image size. The clearest examples are
        the <code>750-658</code> CAN gateway and the <code>750-652</code> RS-232/485
        coupler &mdash; both default to 24 bytes per direction, and the plugin needs
        to know which variant to insert into the device tree.
      </p>
      <p>
        The module catalog therefore exposes a <code>kbusImageSize</code> field on
        affected modules. It carries the bytes-per-direction count (8, 24, or 48)
        and is <code>null</code> for the majority of cards that have a fixed image.
        The plugin uses the value to pick the matching device-ID suffix.
      </p>
      <p>
        Separately, the <code>750-626</code> backplane extension supply&apos;s
        <code>codesysModuleId</code> resolves to <code>880E_075xDigital</code> &mdash;
        which is what the Kbus driver enumerates at runtime and what the plugin
        needs to match against during scan-back-write checks.
      </p>

      <h3>Bus networks hosted by IO cards</h3>
      <p>
        The CODESYS project payload includes CAN and serial networks hosted by IO
        cards (CAN gateways, RS-485 modules), not just the Ethernet networks owned
        by the PLC CPU. Each network appears with its hosting card&apos;s slot
        position so the plugin can attach it to the correct device in the CODESYS
        tree.
      </p>

      <h2>Task Queue</h2>
      <p>
        Long-running operations between MIAS-IO and CODESYS use a <strong>task queue</strong>
        pattern. MIAS-IO creates a <code>CodesysTask</code> record with a type and parameters.
        The CODESYS plugin polls for pending tasks, executes them, and reports results
        back via the API.
      </p>
      <table>
        <thead>
          <tr>
            <th>Task Status</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>QUEUED</strong></td>
            <td>Task is waiting to be picked up by the plugin.</td>
          </tr>
          <tr>
            <td><strong>CLAIMED</strong></td>
            <td>Plugin has started processing the task.</td>
          </tr>
          <tr>
            <td><strong>SUCCESS</strong></td>
            <td>Task completed successfully. Result data is stored.</td>
          </tr>
          <tr>
            <td><strong>FAILURE</strong></td>
            <td>Task failed. Error message is stored for diagnosis.</td>
          </tr>
        </tbody>
      </table>

      <h2>Wiring Recipes</h2>
      <p>
        <strong>Wiring Recipes</strong> define function block call patterns that the
        CODESYS plugin uses to generate structured code beyond simple variable
        declarations. A recipe specifies:
      </p>
      <ul>
        <li><strong>Function Block Name</strong> &mdash; The FB type to instantiate (e.g., &quot;FB_AlarmDigital&quot;, &quot;HMI_Pump&quot;).</li>
        <li><strong>Target GVL</strong> &mdash; Where the FB instance is declared.</li>
        <li><strong>Instance Name Pattern</strong> &mdash; A template for generating the instance name (supports mustache-style variables).</li>
        <li><strong>Parameters</strong> &mdash; Input/output parameter wiring, with different source types.</li>
      </ul>

      <h3>Parameter Source Types</h3>
      <table>
        <thead>
          <tr>
            <th>Source Type</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td><strong>SIGNAL</strong></td>
            <td>Wire to a signal&apos;s main value (resolved by tag or channel offset).</td>
          </tr>
          <tr>
            <td><strong>SIGNAL_RAW</strong></td>
            <td>Wire to the signal&apos;s raw (unscaled) value.</td>
          </tr>
          <tr>
            <td><strong>SIGNAL_SENSOR_FAULT</strong></td>
            <td>Wire to the signal&apos;s sensor fault alarm output.</td>
          </tr>
          <tr>
            <td><strong>INSTANCE_FB</strong></td>
            <td>Wire to the driving component instance&apos;s own function block reference. On wrapper-layer recipes (HMI / PMS / HAL / ALARM), this resolves to the same component instance&apos;s CONTROL recipe output &mdash; see <em>Wiring Recipes</em>.</td>
          </tr>
          <tr>
            <td><strong>CHILD_SIGNAL</strong></td>
            <td>For composite components, address a signal on a named child instance by role + tag suffix. Resolved at codegen to the child&apos;s real signal tag.</td>
          </tr>
          <tr>
            <td><strong>LITERAL</strong></td>
            <td>A fixed constant value.</td>
          </tr>
          <tr>
            <td><strong>EXPRESSION</strong></td>
            <td>A mustache template with variable substitution (e.g., <code>&#123;&#123;instance.tag&#125;&#125;_Enable</code>).</td>
          </tr>
        </tbody>
      </table>
      <p>
        Recipes also carry a <strong>layer</strong> tag (CONTROL / HMI / PMS / HAL /
        ALARM) so a single component can drive multiple FB wirings without
        collisions. See <em>Wiring Recipes</em> for the full layer model.
      </p>

      <h2>CODESYS Settings</h2>
      <p>
        Each project can customize the function block names used during code generation
        via the <strong>CodesysSettings</strong> record:
      </p>
      <table>
        <thead>
          <tr>
            <th>Setting</th>
            <th>Default</th>
            <th>Description</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            <td>FB Alarm Digital</td>
            <td><code>FB_AlarmDigital</code></td>
            <td>Function block for discrete alarm processing.</td>
          </tr>
          <tr>
            <td>FB Alarm Analogue</td>
            <td><code>FB_AlarmAnalogue</code></td>
            <td>Function block for analog alarm processing.</td>
          </tr>
          <tr>
            <td>FB Analog Scaling</td>
            <td><code>FB_AnalogueIn_DeadBand_rev3</code></td>
            <td>Function block for analog input scaling and deadband.</td>
          </tr>
          <tr>
            <td>FB Tank Level</td>
            <td><code>FB_TankLevel</code></td>
            <td>Function block for tank level measurement (used when signal has <code>useTankLevel = true</code>).</td>
          </tr>
        </tbody>
      </table>

      <h2>IEC Paths and Live Monitoring</h2>
      <p>
        After each successful codegen, the plugin pushes resolved IEC paths back to
        MIAS-IO so that the Live Monitoring page can subscribe signals against a
        running PLC. Two paths are pushed per signal:
      </p>
      <ul>
        <li><strong><code>iec_path</code></strong> &mdash; the SCALED (engineering) value path; what the HMI reads.</li>
        <li><strong><code>iec_path_raw</code></strong> &mdash; the RAW (HAL) value path; what calibration UIs read so they don&apos;t calibrate against already-scaled data.</li>
      </ul>
      <p>
        The paths are pushed via <code>POST /api/codesys/project/:id/iec-paths</code>
        with a body of the form <code>{`{ paths: [{ signalId, iecPath, iecPathRaw }] }`}</code>.
        Each entry upserts the matching signal; passing <code>null</code> clears a
        previously-resolved path so the signal drops out of any active monitoring
        subscriptions.
      </p>
      <p>
        Once a path is populated, the user can enable monitoring on the project&apos;s
        Monitoring tab. The plugin then polls
        <code>GET /api/codesys/project/:id/monitoring/subscriptions</code> for active
        subscriptions, reads the matching IEC paths from the PLC, and posts readings
        back via <code>POST /api/codesys/project/:id/monitoring/readings</code>. See
        the Live Monitoring section for the user-facing flow.
      </p>

      <h2>CODESYS Import</h2>
      <p>
        MIAS-IO can also import data from existing CODESYS projects. The
        <strong>CodesysImport</strong> feature parses <code>.fbsproj</code> project files and
        extracts:
      </p>
      <ul>
        <li><strong>FB Definitions</strong> &mdash; Function block declarations, including inheritance relationships.</li>
        <li><strong>FB Instances</strong> &mdash; Instantiated function blocks with their parameter values.</li>
        <li><strong>Variables</strong> &mdash; GVL variable declarations matched to MIAS-IO signals.</li>
        <li><strong>Connections</strong> &mdash; FB input/output wiring connections.</li>
      </ul>
      <p>
        This is useful for reverse-engineering an existing CODESYS project into MIAS-IO,
        or for verifying that the generated code matches the actual project state.
      </p>

      <h2>Workflow Summary</h2>
      <ol>
        <li><strong>Configure hardware and signals</strong> in MIAS-IO (this application).</li>
        <li><strong>Set up the plugin</strong> with the MIAS-IO server URL and API key in <code>config.ini</code>.</li>
        <li><strong>Open CODESYS</strong> and run the plugin script. It registers a session with MIAS-IO.</li>
        <li><strong>Sync hardware</strong> &mdash; the plugin pulls the hardware tree and creates/updates the CODESYS device configuration.</li>
        <li><strong>Sync GVLs</strong> &mdash; the plugin generates variable declarations from MIAS-IO signal data.</li>
        <li><strong>Sync wiring</strong> &mdash; the plugin creates FB instances and wiring from recipe definitions.</li>
        <li><strong>Review and build</strong> &mdash; verify the generated code in CODESYS and compile the project.</li>
      </ol>
      <p>
        Changes in MIAS-IO can be re-synced at any time. The plugin uses an additive
        update strategy: new signals and hardware are added, removed items are flagged,
        and existing items are updated in place.
      </p>
    </article>
  );
}

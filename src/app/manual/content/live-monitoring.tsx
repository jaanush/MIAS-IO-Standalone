export function LiveMonitoringSection() {
  return (
    <article className="prose prose-sm dark:prose-invert max-w-none">
      <h1>Live Monitoring</h1>
      <p className="lead text-muted-foreground">
        Live Monitoring lets you stream the current value of any signal in a project
        from a running PLC into MIAS-IO. The CODESYS plugin polls the PLC at the
        configured interval and pushes readings back to the server, where they show
        up on the Monitoring page and in the curve-editor calibration dialog.
      </p>

      <h2>Where to find it</h2>
      <p>
        Open a project and pick the <strong>Monitoring</strong> tab in the left
        sidebar (<code>/projects/[id]/monitoring</code>). The page lists every signal
        in the project with its origin and a pair of monitoring slots.
      </p>

      <h2>Two slots per signal: SCALED and RAW</h2>
      <p>
        Each signal has two independent monitoring slots:
      </p>
      <ul>
        <li>
          <strong>SCALED (DAO)</strong> — the engineering value the HMI reads. For
          analog inputs this is the value after raw-to-scale conversion, sensor-fault
          masking, and any deadband applied by the data-access layer.
        </li>
        <li>
          <strong>RAW (HAL)</strong> — the unscaled reading at the hardware-abstraction
          layer. For a 4-20 mA input that&apos;s the integer ADC count; for a Modbus
          register it&apos;s the raw register value.
        </li>
      </ul>
      <p>
        Each slot has its own <strong>ON / off</strong> toggle, an interval selector
        (1 s, 5 s, or 30 s), and a &quot;Latest&quot; cell that shows the most recent value
        plus its quality state (<code>GOOD</code>, <code>BAD_SENSOR_FAILURE</code>,
        etc.). Toggling SCALED and RAW independently means you can keep a calibration
        target subscribed at fast cadence in RAW mode without also flooding the
        scaled-value rail.
      </p>

      <h2>Why two modes?</h2>
      <p>
        Calibrating an analog sensor from already-scaled data is circular — the curve
        you&apos;re trying to derive is what produced the scaled value in the first place.
        For calibration you want the underlying RAW reading. The Monitoring page
        therefore exposes both rails, and the curve editor (see <em>Components &amp;
        Templates → Component parameters</em>) defaults its live-capture button to
        RAW.
      </p>

      <h2>The &quot;no path&quot; state</h2>
      <p>
        A monitoring slot can&apos;t be enabled until the plugin has populated the
        underlying IEC path for that signal. Until then the toggle reads &quot;no path&quot;
        and is disabled. The plugin pushes paths after each successful codegen run
        via <code>POST /api/codesys/project/:id/iec-paths</code>, supplying both
        the SCALED path (<code>iec_path</code>) and the RAW path (<code>iec_path_raw</code>).
      </p>
      <p>
        At the top of the page, four counters summarise the state of the project:
        total signals, scaled-ready, raw-ready, and currently-monitored. Use the
        <strong>Codegen-ready only</strong> filter when you want to see just the
        signals that are wireable right now.
      </p>

      <h2>How readings flow</h2>

      {/* Monitoring data flow diagram */}
      <div className="my-8 flex justify-center">
        <svg viewBox="0 0 720 220" className="w-full max-w-2xl" xmlns="http://www.w3.org/2000/svg">
          <defs>
            <marker id="lm-arrow" viewBox="0 0 10 7" refX="10" refY="3.5" markerWidth="8" markerHeight="6" orient="auto-start-reverse">
              <path d="M 0 0 L 10 3.5 L 0 7 z" className="fill-foreground" />
            </marker>
          </defs>

          {/* PLC */}
          <rect x="20" y="80" width="120" height="60" rx="8" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="80" y="105" textAnchor="middle" className="fill-foreground font-medium" fontSize="12">PLC</text>
          <text x="80" y="122" textAnchor="middle" className="fill-muted-foreground" fontSize="10">live values</text>

          {/* Plugin */}
          <rect x="180" y="80" width="160" height="60" rx="8" className="fill-primary/15 stroke-primary" strokeWidth="1.5" />
          <text x="260" y="103" textAnchor="middle" className="fill-foreground font-medium" fontSize="12">CODESYS Plugin</text>
          <text x="260" y="120" textAnchor="middle" className="fill-muted-foreground" fontSize="10">poll-and-push loop</text>

          {/* MIAS-IO */}
          <rect x="380" y="80" width="160" height="60" rx="8" className="fill-muted stroke-border" strokeWidth="1.5" />
          <text x="460" y="103" textAnchor="middle" className="fill-foreground font-medium" fontSize="12">MIAS-IO Server</text>
          <text x="460" y="120" textAnchor="middle" className="fill-muted-foreground" fontSize="10">SignalReading store</text>

          {/* UI */}
          <rect x="580" y="80" width="120" height="60" rx="8" className="fill-primary/15 stroke-primary" strokeWidth="1.5" />
          <text x="640" y="103" textAnchor="middle" className="fill-foreground font-medium" fontSize="12">Monitoring</text>
          <text x="640" y="120" textAnchor="middle" className="fill-muted-foreground" fontSize="10">page / CurveEditor</text>

          {/* Arrows */}
          <line x1="140" y1="110" x2="180" y2="110" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#lm-arrow)" />
          <line x1="340" y1="110" x2="380" y2="110" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#lm-arrow)" />
          <line x1="540" y1="110" x2="580" y2="110" className="stroke-foreground" strokeWidth="1.5" markerEnd="url(#lm-arrow)" />

          <text x="160" y="100" textAnchor="middle" className="fill-muted-foreground" fontSize="9">read</text>
          <text x="360" y="100" textAnchor="middle" className="fill-muted-foreground" fontSize="9">POST readings</text>
          <text x="560" y="100" textAnchor="middle" className="fill-muted-foreground" fontSize="9">tRPC query</text>

          {/* Subscription back-channel */}
          <line x1="380" y1="150" x2="340" y2="150" className="stroke-foreground/60" strokeWidth="1.2" markerEnd="url(#lm-arrow)" strokeDasharray="3 2" />
          <text x="360" y="170" textAnchor="middle" className="fill-muted-foreground" fontSize="9">subscriptions</text>
        </svg>
      </div>

      <p>
        When you toggle a slot on, MIAS-IO writes a subscription row. The plugin
        pulls the project&apos;s active subscriptions on every iteration of its loop,
        reads the matching IEC paths from the PLC, and posts the readings back to
        <code>POST /api/codesys/project/:id/monitoring/readings</code>. The
        Monitoring page&apos;s &quot;Latest&quot; column reflects whatever is currently in the
        reading store for each (signal, mode) pair.
      </p>

      <h2>Calibration with the curve editor</h2>
      <p>
        The reusable <strong>Curve Editor</strong> (used for any
        <code>CURVE</code>-typed component parameter) embeds a live-capture panel
        whenever it&apos;s opened in a project context. The panel lets you:
      </p>
      <ol>
        <li>Pick a source signal — the dropdown lists signals that have monitoring enabled.</li>
        <li>Choose <strong>RAW</strong> (default) or <strong>Scaled</strong> mode.</li>
        <li>Watch the latest reading update every two seconds.</li>
        <li>Click <strong>Capture → x</strong> to copy the current reading into the next empty <em>x</em> cell of the curve.</li>
      </ol>
      <p>
        The default RAW mode is intentional: when you&apos;re building, say, a
        tank-volume curve, you want to capture the unscaled sensor reading at the
        physical tank level you&apos;ve set up, then enter the engineering value
        (litres, percent) as <em>y</em>. Capturing in scaled mode would calibrate the
        curve against itself.
      </p>

      <h2>Field calibration workflow</h2>
      <p>
        A typical tank-level calibration on site looks like this:
      </p>
      <ol>
        <li>Run codegen so the plugin has pushed <code>iec_path_raw</code> for the level sensor.</li>
        <li>On the Monitoring page, enable RAW monitoring for the sensor signal at 1 s.</li>
        <li>On the project&apos;s Components page, expand the tank-sensor instance and click <strong>Edit curve</strong> on its <code>volumeCurve</code> parameter.</li>
        <li>In the curve editor&apos;s live-capture panel, pick the same sensor and confirm RAW mode.</li>
        <li>Drain the tank to a known level, click <strong>Capture → x</strong>, and type the engineering value as <em>y</em>.</li>
        <li>Repeat across the calibration range; rows must remain ascending in <em>x</em>.</li>
        <li>Save. The curve is now bound to the instance parameter and will be picked up on the next codegen.</li>
      </ol>
      <p>
        See <em>JMobile Alarm Numbering</em> for a related project tab that depends on
        the same plugin-pushed IEC paths.
      </p>
    </article>
  );
}

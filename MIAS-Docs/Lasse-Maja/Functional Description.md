# Functional Description — M/S Lasse Maja III

> Converted from 25425-852-51 Functional description AF Comments.docx


Functional description 
MIAS 
METS Integrated Automation System M/S Lasse Maja III



Revision log

Abbreviations:

References:



Introduction
Background
M/S Lasse Maja III a conventional diesel driven passenger ferry owned and operated by Kungälvs kommun will be converted to a fully electric ship. Mets have been awarded to deliver the battery electric propulsion and power distribution system as well as a control and monitoring system for the ship.
Project scope
The responsibility of METS is to design and develop the electrical and automation system needed. 
METS will deliver:
An integrated automation system MIAS (METS Integrated Automation System) to control and monitor propulsion and the ships’ power distribution system. In addition, the system will be used for general monitoring and control of some IOs.
Propulsion motors, propulsion inverters, microgrid converter and transformer as well as generator converter.
METS will also deliver a high-power dc shore supply.
Switchboard for DC, local control cabinets for converters and backup control at bridge.
Switchboard for AC, and AC shore supply.
Distribution board for 24VDC.
Remote connection to MIAS for remote monitoring.
Charging station at shoreside, high-power DC via 2pcs CCS2 connectors.
Software development and electrical engineering of above-mentioned systems.
The shipyard will procure propulsion control system, the genset, batteries and needed systems for the battery installation and all other ship systems. The shipyard will also cover all installation.
System references
METS has done previous projects of similar character. 
Prins Daniel, Strömma turism och sjöfart
Passenger ferry, Conversion to battery electric propulsion from conventional diesel motor. MIAS control and monitoring of propulsion, power distribution and dedicated ship systems.
Kostervåg, Koster Marin
Catamaran, Conversion to battery electric propulsion from conventional diesel motors. MIAS control and monitoring of propulsion, power distribution and all new ship systems.
Eloise (Älvskyttel), Styrsöbolaget
Shuttle-Ferry, Newbuild, Battery-electric propulsion. MIAS control and monitoring of propulsion, power distribution and all ship systems.
General description
Kungälvs kommun´s ship Lasse Maja will be converted to a fully electric ship powered by batteries from conventional diesel engine propulsion.
The vessel will be retrofitted according to STA.
The vessel will have two equal propulsion plants with pods driven by electric motors (approximately 184kW @ 2200rpm each) via reduction gears in the pods (propeller speed approximately 700?rpm).
Main source of power will be two batteries with an energy content of approximately 378kWh fwd and approximately 404kWh aft.
In addition, there will be a genset of approximately 130kW.
The genset is to be used mainly as back-up power supply in case of battery failure or as a range extender in conjunction with the batteries.
The power distribution will be based on a DC distribution system with variable voltage, with inverters and transformers supplying both the ship and propulsion with power, with a lot of possibilities.
A main switchboard (MSB DC) will make up the main part of the DC distribution system.
To supply the 230VAC consumers onboard, two microgrid converters and two transformers will be installed and connected to a main switchboard (MSB AC), which will distribute 3-phase 230VAC to the connected systems.
An electric motor for each drive train is controlled by an inverter, transforming the DC-voltage to AC and controlling the electric output to the motor.
The genset power will be controlled by an inverter, transforming the AC-voltage to DC and controlling the electric output from the generator.
The battery power flow will be controlled by the propulsion inverters, microgrid converters, generator inverter and the DC shore supply via MSB DC, microgrid and propulsion for discharging and generator or microgrid operated as AFE or the shore supply for charging the battery.
A shore supply of 400VAC will be able to supply the ship with AC load and charge the batteries at quay side.
A high-power DC shore supply is intended to be able to quickly charge the batteries, it will be connected directly to MSB DC, the charging process will be controlled and monitored by MIAS.
To control the ships main and auxiliary systems, MIAS will be adapted and installed.
MIAS to include propulsion control (partial), PMS, EMS, general control and monitoring, and alarm system functionality.
MIAS will consist of a controller with local IO´s.
Monitoring, alarms and control is available on one operating panel in the wheelhouse and one in the engine room. Propulsion will have a dedicated operating panel for monitoring in the wheelhouse.
The system will be powered from two independent power supplies.
Backup control panels will be installed on the bridge to be able to control propulsion motor speed and power generation without MIAS in operation. 
There will also be local control cabinets next to the connected equipment making it possible to control the equipment locally. 
MIAS (METS Integrated Automation System)
MIAS (METS Integrated Automation System) is an Integrated Automation System (IAS) called MIAS. The system could be utilized in different ways by combining below listed main features. 
Alarm system
General control and monitoring
Power Management System (PMS)
Energy Management System (EMS)
Propulsion Control System (PCS)
The system hardware is put together dependant of requirements and becomes installation specific. The user interface is standardized and described in the manual of the system.
 MIAS Hardware
Main components such as: Controllers, distributed I/O´s, operating panels, network switches, power supplies are marine type approved.
MIAS is the primary controller of the electrical/automation system and alarms onboard.
It consists of one controller with local IO’s or/and distributed IO’s located around the ship normally located in the engine room and the wheelhouse.
MIAS could also be redundant in that case there are two controllers, both in contact with all communication buses and with distributed IO’s located around the ship normally in the engine room and the wheelhouse.
Power supply to MIAS is done from two independent power sources with automatic switching to the backup supply in case the main supply fails. Power supply switching is done without interruption of 24V power supply to the connected equipment. 
The internal communication network is either built up by a single network switch or more switches, if there is more than one network switch in the network the network is made redundant by a ring topology. The ring ethernet network consists of two or more network switches which form a redundant communication process, if one link in the ring fails the communication is still maintained. 
One or more operating panels are available and used as the interface for MIAS.
Normally two of them will be used to control the ship systems, alarms and show all equipment information available. Should one of these two panels fail, the same information and control will be available on the other one.
These panels are normally located in in the engine room and the wheelhouse.
If MIAS is in control of Propulsion a dedicated operating panel will be used to show propulsion information for the operator, no control, or alarms available on this screen.
The same information is available on the other two panels as well, but in the propulsion one there is a simplified way of showing the information to the operator.
See: Figure 1 - Overview of MIAS main components and communication ways and 
Figure 2 - Block diagram of MIAS and connected systems for project specific details.

Figure 1 - Overview of MIAS main components and communication ways

Figure 2 - Block diagram of MIAS and connected systems

MIAS HMI (Human Machine Interface)
The main interface to MIAS is through operating panels where all main features and functions can be accessed, monitored, and controlled. The interface is built-up to fulfill standard requirements in terms of user friendliness coloring of objects and safety features to prevent simultaneous changes to the system.
The general user interface of MIAS is thoroughly explained in the manual of the system.
Alarm system
MIAS incorporates an E0 alarm system for unattended machinery space.
Alarms will be displayed in one operating panel in wheelhouse and one in the engine room.
As per the E0 demands there will also be audible and visual indications in some spaces:
Attention alarms: engine room (light and sound)
Buzzers: buzzer in proximity of the wheelhouse operating panel
If the specific alarm system fulfills E0 demands depends on the number of operating panels and indications.
Alarms will be divided in three groups A, B and C whereas:
Critical faults
Non-critical faults
Notifications
See Mimic 1 – Mimics for alarms: active, history, settings, settings difference to get an overview of the Mimics.
The alarm system functionality and features are standardized and described in the manual of the system.

Mimic 1 – Mimics for alarms: active, history, settings, settings difference
General control and monitoring
MIAS is used for monitoring, alarm handling and control of several different systems. 
Three types of user interface are available:
Operating panels and/or main control panels.
There are generally two ways to control systems from the operating panels, automatic or manual. (Manual for main systems consists of start stop mode where auto, forced on and forced off could be selected)
When systems are put to automatic in MIAS, protection features and control functions are active, in manual control from MIAS protection features and control functions are normally disabled.
Wheelhouse backup panels (only for essential systems)
Propulsion, power generation/distribution and other essential systems normally has a backup control option available from wheelhouse. Functional even if MIAS is inoperable.
Local control cabinets.
In Local control only some crucial protection features are available.
Warning: In Manual mode from MIAS and Local control the operator can use components of systems in a way that they can be damaged or make the ship not operable.
Emergency stop for essential systems is normally available in both engine room and in the wheelhouse, wheelhouse emergency stop could cover more than one system to be able to stop connected functions immediately.
Details regarding monitoring and standard control functions such as start stop mode is described in the manual of the system.
See section: 6 General control and monitoring for project specific functions.
Power Management System
MIAS has integrated functionality for electric power generation handling and distribution. The system controls both the DC side by converters and on AC by means of stopping non-essential heavy consumers. The functionality is controlled and adjusted in the MIAS operating panels.
MIAS also incorporates Energy Management functions in terms of readymade efficiency and optimization functions for energy storage systems. 
See section: 5.7 Power Management System for project specific functions.
Propulsion Control System
MIAS has integrated functionality for propulsion control, both electric and ICE propulsion.
Refence handling from actuators and levers are evaluated in controller and reference signals are then sent to converters, engines and other systems in a controlled and secure manner. Backup control is always available.
See section: 4 Propulsion for project specific functions.

Accessibility
MIAS can be accessed by an internal monitoring network. The access is made through a network bridge configured to give limited access to the control network.
MIAS can also be accessed remotely via an encrypted cloud service with user management. This access will be through a router/gateway inhibited by a physical key switch giving crew the possibility to allow remote access or not. The router/gateway will have functions for email notifications which will be used for remote notification of alarms on the ship. 
The key switch will have three different positions as per below: 
“OFF” will cut the power to the router/gateway. 
“ON” router/gateway will be turned on and VPN disabled, view-only VNC-access. 
“Full access” router/gateway will be turned on and VPN available. 
DC Based distribution system
MIAS incorporates functionality for control and monitoring of converters connected via a DC-bus. The functionality covers sources and consumers of all types. Power management and load handling is made easier since the loads connected to DC could easily be limited to fit the actual momentary power available.
Self-regulating DC distribution system
The DC distribution system onboard has two purposes:
Transfer power between systems onboard.
Communicate between sources and consumers how much power is available.
Each converter connected to MSB DC has built-in limits for when to be allowed to generate or consume power. These limits are set in relation to the voltage of the MSB which will vary depending on the power available.
Explanation:
Low voltage on MSB DC = lack of power
High voltage on MSB DC = too much power is generated
As these limits are executed already in the converters, the response time is quick. Should there be lack of power (low DC voltage), the consumers will hold back their consumption until there is enough power available again. Power to essential consumers can thus also be prioritized.
This concludes that the DC distribution system will be very robust and minimize the risk of blackout.
The system can also be built up with batteries connected to MSB DC without a DC/DC, above functionality is slightly different but with the same base functions. Since the battery SOC is also represented by the voltage.

Converters
Each converter has its built-in Controller. Therefore, they have the function to operate independently with or without the MIAS Controller. The converters carry a complete set of monitoring signals, warnings, and fault alarms. Among the alarms there is: overcurrent alarms, under- and overvoltage alarms, short circuit alarms and temperature alarms which all will trip and disconnect the converter immediately. Converters for essential functions connected to the DC distribution system can be controlled in three ways for redundancy:
Control and monitoring via CAN-bus from MIAS Controller.
Backup control from wheelhouse. Functional without MIAS.
Local control. Functional without MIAS.
Non-Essential functions lacks the backup control feature.
In each one of the control modes, MSB voltage limits are obeyed so that the DC distribution system will be kept operational and within limits.


Figure 3 - Block diagram of communication and signal distribution for converters.

Propulsion
Electric motor and control
A water-cooled permanent magnet electric motor is connected to each propeller via a pod including a reduction gear to supply the ship with power for propulsion.
The electric motor will be controlled and monitored by MIAS via an inverter.
Technical electrical limitations limit the speed of the electric motor to an approximate max of 2450rpm.
Propulsion output power is limited to:
Electric motor/mechanical maximum allowable torque.
Pod maximum allowable torque.
Shaft maximum allowable torque.
Propeller maximum allowable torque.
Momentary available power on DC distribution system.
Limitation is performed by the propulsion converter.
The maximum power that could be utilized by propulsion is dependent on the maximum allowable torque from the electric motor, the speed that could be reached by this torque will limit the maximum power of the propulsion. Design power required is 184kW at 2200rpm.
Functionality is built into the system to prevent accidental rotation of the propellers.
If changing Ship operational mode from Harbour mode to Sea mode, lever/reference signals must be set to zero, to start propulsion. When the lever/reference first has been set to zero, the levers/reference signals can be used normally again.
The propulsion system features a lever response function with three settings: Economy, Normal, and High. Economy setting prioritizes fuel efficiency with smooth acceleration, Normal setting balances performance and efficiency for standard operations, while High setting enables rapid acceleration and powerful maneuvers for challenging situations. This flexibility allows the operator to optimize performance based on operational needs, ensuring effective and safe navigation. This function can be engaged or disengaged as a setting in MIAS.
Electric motor speed is monitored by a resolver connected to the inverter.
Since propulsion power is made from an electrical motor the propeller speed could be varied from zero to full rpm, lever position 0 means 0 rpm. If there is no other equipment along the shaft requiring a minimum speed.
The propulsion control system (PCS) supplied by Kongsberg will send a reference signal to MIAS and directly to the inverter for backup control.
Propulsion systems could be emergency stopped individually from wheelhouse. Emergency stop in the wheelhouse stop both PCS and inverter/motor, locally the emergency stop stops the individual function.

Propulsion control can be done in three ways described below.
Normal control:
Propulsion is allowed to start when “sea mode” is chosen. (See 7.1 Ship operational modes)
Propulsion lever position is sent to MIAS from PCS.
MIAS sends start signal and reference signal to the propulsion converter via CAN-bus.
Wheelhouse backup control: (If MIAS is inoperable)
Also read section 5.3 Microgrid/AFE for power generation.
Propulsion is made operational by setting propulsion switch from Auto to Backup, on the wheelhouse backup panel.
Propulsion lever position is sent directly to inverter from PCS.
Local control:
Also read section 5.3 Microgrid/AFE for power generation.
Propulsion inverter is started locally.
Propulsion speed is locally controlled.
Power limits is controlled as described in section “3.8.1 Self-regulating DC distribution system”.


Figure 4 – Draft Block diagram Propulsion control

Mimic 2 – Draft Mimic in MIAS display for propulsion etc.
 
Figure 5 – Wheelhouse backup panel


Figure 6 Propulsion local control cabinet
Pod and PCS
There is a pod for each drive train that can control the direction of the propulsion thrust in relation to the ship.
The built-in reduction gear has a ratio of 3:1 to make the propeller shaft rotate slower than the motor.
The Propulsion Control System (PCS) is supplied by Kongsberg and will be interfaced to MIAS. Speed reference and crucial monitoring signals will be sent from PCS to MIAS.
See supplier documentation.

Power-generation, -management, -storage and -distribution
There are three main sources of power onboard, battery system fwd, battery system aft and a genset. All three sources supply DC power to MSB DC. If one of the three power sources is not available, the other can continue to supply the ship.
There are two microgrid converters that supply AC to consumers from DC. If one of the two microgrid converters is not available, the other can continue to supply the ship.
Batteries
A battery of chemistry type NMC is installed, supplied by Kreisel.
The battery is divided into two independent battery systems fwd and aft.
Fwd battery system comprises 1 BMS (Battery Management System), 3 battery strings with 2 modules in series each.
Aft battery system comprises 1 BMS (Battery Management System), 4 battery strings with 2 modules in series each.
The batteries onboard can supply either both propulsion and hotel load or only hotel load.
The batteries could be charged from either one of the shore supplies or the genset.
MIAS will be used as a parent system to send commands and monitor alarms, statuses, and signals to/from the BMS, all signals are communicated by bus. 
MIAS will implement safety features to operate the battery within operational limits, but the ultimate safety will be handled by the BMS.
MIAS will follow the operational limits from BMS. Safety limits and battery health will be handled by the BMS.
The battery pack will be connected directly to the MSB, control of charging/discharging is handled by the converters connected to MSB.
Communication is required to be able to control and get readings from the battery system. 
If communication fails, the battery will disconnect.
It is not possible to connect a disconnected battery if communication has failed. 
MIAS will be designed to keep within the current limits communicated from BMS for charging and discharging. The charging process will either be limited by the power available or the charging current limitation from the BMS.
The discharging process will be limited by the discharging current limitation from the BMS. If the discharging current limit is lower than the need of the ship, MIAS will limit the power usage of the ship (propulsion, and AC load shedding if available).
MIAS will send command to connect to the battery systems. Each string will connect when the voltage of the DC-bus is within the voltage window accepted by the string. See supplier documentation for further details.
Each string has a pre-charge circuit used to balance the voltage of the DC distribution system with the battery string before connecting the string. This is needed to avoid a high inrush current when connecting, which would damage components connected to the MSB DC or/and the batteries. 
Pre-charging is done every time the string(s) is connecting if needed.
Since the pre-charging circuit of the batteries are too weak in relation to the capacitance of the DC-bus, an additional stronger pre-charge circuit is added in MSB DC for each pack.
The additional pre-charge circuit is sufficient to pre-charge the whole DC distribution system from 0VDC to the actual battery voltage. Although pre-charging repeatedly should not be done to avoid overheating the pre-charge circuit.
If one or more battery strings are disconnected, and voltage differs between the battery strings it is possible that not all strings will be connected when trying to connect. Unconnected strings will connect as soon as the voltage on the inside and outside of its breaker are within a certain voltage window (to an unpowered DC-bus pre-charge function will be used). To get all strings connected the connected strings voltage needs to be changed by charging/discharging that string.
If one of the two battery packs are disconnected, and voltage differs between the battery packs it is possible that the unconnected pack can’t be connected. The unconnected pack will connect as soon as the voltage on the inside and outside of its breaker are within a certain voltage window (to an unpowered DC-bus pre-charge function will be used). To get both packs connected the connected pack voltage needs to be changed by charging/discharging that pack.
There will be a power limitation if not all strings are connected, approximately 1C per string will be allowed.
Frequent topping up charge (small charges in the top SOC/battery level range) should be avoided since it puts unnecessary stress on the batteries. Therefore, a hysteresis level is implemented, if the battery is fully charged it needs to go below a certain level before being charged again.
Battery related alarms are also handled by MIAS, an example of them is described below, for more information about MIAS alarms, see alarm-list. 
Not all battery strings connected, power limited
One or more battery strings are not connected, battery charge/discharge is limited to protect the battery from too high input/output.
Low battery level (default 5%)
Warning indicating the battery level are low, (user adjustable level).
Critically low battery level (default 3%)
Alarm indicating the battery level are critically low, (user adjustable level).
No backup or local control for batteries is available.
For BMS and battery specific information, see supplier documentation.
Battery Utilization
The battery management system indicates the current available energy as SOC (State of charge).
The SOC has a fixed range between 0 and 100%, whereas 0% indicates when the battery is completely empty, and 100% indicates completely full.
It is recommended to avoid these max and min SOC values to maintain battery lifetime and reduce the risk of damaging the battery cells.
Representation of each battery string signals such as SOH, SOC and other battery specific information will be shown on battery details mimic on the operating panels.  
The usable SOC max/min limits adhere from the battery chemistry. To simplify the interface for the operator and show a fixed usable level between 0 – 100%, a battery level indicator is used in MIAS operating panels.
The battery level value is a scaled value directly translated from the usable SOC of the battery pack.
To protect the batteries during normal operation MIAS will not allow usage of the batteries below or above a level where the batteries could be damaged beyond repair. Thus, making sure Battery level charging to 100% is following the safe limits for the batteries. Discharging to 0% SOC will damage the batteries and should be avoided, however in an emergency the user could override the system and use the battery down to 0%. A message will inform the operator at a defined low battery level “Battery disconnection warning” and prompt the operator to take a decision whether to continue using the batteries due to an emergency where the battery life is secondary. If not chosen the discharging will be stopped. If chosen discharging can continue as long as the batteries cope with it.
Connected alarms:		              Figure 7 – Translation SOC to Battery level, operating range
Battery disconnection warning (SOC6%)
Active when operator is prompted to stop, (level not adjustable).
As long as battery level is below this limit the message and choice to continue will be visible on the operating panel.
Battery empty
Active at battery level corresponding to disconnect level, (level not adjustable).
Battery level emergency override active
The battery level both individual and total will also be an indication of available energy because it is built up by the SOC of one or more strings or batteries together. If all strings or batteries are not connected the battery level will be representing the energy available. This means the battery level could only reach 100% if all strings within the battery pack are connected or all batteries of the ship are connected.
Charging and discharging will be controlled by battery level, total SOC and eventually individual string SOC to not overcharge/discharge individual strings.
In some cases, the maximum discharge power from the batteries can be quite low due to circumstances as temperature, low battery charge levels etc. If the ship's peak power consumption is more than the actual maximum discharge power, MIAS will generate an alarm “Reduced power available” if going below a certain SOC level to warn the operator that the ship might not behave as under normal conditions.
Normal operation of the batteries will be guided by MIAS, MIAS will generate a lifetime warning and a lifetime alarm to prompt the user to stop discharging, however it is the operator’s choice to continue anyway.
Lifetime warning (battery level 2%)
Active when operator is prompted to stop, (level not adjustable).
Lifetime alarm (battery level 0%)
Active at battery level corresponding to intended stop level, (level not adjustable).
For details regarding lifetime see 5.1.2 Battery Lifetime. 
Clarification:
SOC limits 0% and 100% should be avoided. 
Battery level 100% to 0% could be used during normal operation.
The operator can continue using the battery at battery level 0%, but this will affect the lifetime of the battery negatively and should be avoided.
If the operator chooses to continue below battery level 0% the total SOC should instead be monitored (available on battery details page).
Battery will be disconnected at SOC5% (if not operator have chosen to continue).

Figure 9 – Battery level compared to SOC at BOL

Figure 10 – Battery level compared to SOC at EOL
Battery Lifetime
An intended operational profile is often the determining factor for the selected energy amount in the battery.
If a certain amount of energy is needed to perform the intended operational profile a setting is available to cope with the degradation of the battery over time (the degradation of the battery is measured in State of Health (SOH)).
Since the lifetime of the battery could be secondary in an emergency situation MIAS will not disconnect the battery but only give warning and alarm to inform the operator of the situation. The operator can still continue discharging after the alarm has been generated but the lifetime of the batteries can be shortened during such operation.
The scaling of battery level from SOC can be adjusted by the user to maintain the same amount of energy in the battery level.
Example SOH:
A battery of 1000kWh with SOH100% contains 1000kWh, a battery of 1000kWh with SOH50% contains only 500kWh.
Example Battery level scaling:
Total battery capacity 200kWh. 
Needed energy according to operational profile and lifetime calculations: 100kWh. 
100kWh / 200kWh = 50% of SOC span. 
Battery level 0-100% need to use 50% of the SOC span to get the required 100kWh of energy and could be set to for example SOC 25-75%. 
After some usage the battery is degraded to a level of SOH80%. 
To maintain the same amount of energy in the battery level range 0-100% the scaling can now be adjusted. 
Total battery capacity is now: 200kWh * SOH80% = 160kWh. 
100kWh / 160kWh = 62,5% of current SOC span. 
Battery level 0-100% need to use 62,5% of the SOC span to get the required 100kWh of energy and could be set to for example SOC 18,5-81%
Project specific:
The batteries are dimensioned for a lifetime of at least xx years.
During these years the batteries can be utilized with xxx cycles of approximately xxx kWh.
The Degree of Discharge (DOD) at Beginning of Life (BOL) needs to be xx% to get this energy and the SOC range utilized at BOL will be xx-xx%.
The DOD at End of Life (EOL) needs to be xx% to get this energy and the SOC range utilized at EOL will be xx-xx%.
Battery failure scenarios
Communication failure:
No communication with BMS.
Alarms generated: Communication alarm.
Battery system disconnects.
Controller failure (all Controller outputs to safe state):
Alarms generated; Controller connection lost.
Battery system disconnects.
Battery string alarm and disconnection:
Battery string with fault state is disconnected by BMS and MIAS power limit might get active if nearing discharge limit for battery pack.
Emergency stop is pressed:
Alarms generated; Battery system emergency stopped.
Battery system disconnects.

Genset
An engine Volvo Penta marine engine with a rating of approx. 100kW will be installed.
The engine will be controlled and monitored by a local ComAP which will be in charge of the safety functions connected to the engine.
MIAS will be used as a remote-control system and for monitoring and alarm.
Functions:
Start failure: If a start attempt is not successful within a defined time a start failure alarm will be given, to allow additional start attempts the alarm needs to be reset, automatically reset if the engine is started from another control position.
A function that prevents MIAS from starting/stopping the engine repeatedly is implemented.
The operator could by push buttons etc. in the ship change the state of the engine from running to stopped and vice versa. If the actual state of the engine differs from MIAS intended state, an alarm will be generated.
MIAS is allowed to change the state back again after a defined time has elapsed.
The engine is connected to a water-cooled permanent magnet electric generator to supply the ship with power. 
The electric generator will be controlled and monitored by MIAS via an inverter.
The genset will be used at a fixed speed.
Technical electrical limitations limit the speed of the electric generator to an approximate max of 2640rpm.
The genset can supply propulsion, grid and charge the batteries either all together or individually via MSB DC.
The genset is to be used mainly as a back-up power supply in case of battery failure or as a range extender in conjunction with the batteries.
Output power is limited to engine, generator, converter maximum and settings in PMS.
Genset could be emergency stopped from wheelhouse or locally in engine room.
Genset control can be done in three ways described below.
Normal control:
Engine via hardwired interface from MIAS.
Inverter via CAN-bus from MIAS.
Wheelhouse backup control: (If MIAS is inoperable)
Engine is started via dedicated hardwired interface in wheelhouse.
Inverter is started via dedicated switch. For layout of panel see Figure 5 – Wheelhouse backup panel and backup control instruction see 5.9 Blackout recovery.
Local control:
Engine can be locally started on local ComAP interface.
Inverter can be locally started.
For more details regarding the engine see supplier documentation.
Engine failure scenarios
Modbus failure:
No feedback from diesel engine available in MIAS.
Alarms generated: Communication alarm.
Engine keeps running.
Controller failure (all Controller outputs to safe state):
Alarms generated; Controller connection lost.
Engine keeps running.
Engine backup control in wheelhouse to be used.
Engine alarm and stop or emergency stop:
Engine is stopped.
Microgrid/AFE
The Microgrid/AFE converter is used for two different functions.
Generate the onboard grid (400VAC) from MSB DC. “Microgrid operation”.
Convert the shore supply (400VAC) to DC to be able to charge the batteries from shore. “AFE operation”.
The converter needs to be stopped to change function, however in normal operation this means no stop in the power distribution.
Output power is limited to transformer/converter maximum.
Power limits to not overload the shore supply when in AFE operation is calculated by subtracting the power consumed by the ship from the power available from shore.
The available power from shore is a user adjustable limit.
The grid connection will be provided with an energy meter to keep track of supplied power in MIAS.
The hotel load transformer will have continuous temperature monitoring and generate alarms at high temperatures. MIAS will stop the transformer when reaching critically high temperature.
If the converter reaches critically high temperature the grid converter switch will be disconnected to protect the converter from overheating.
Microgrid/AFE control can be done in three ways described below.
Normal control:
Control of the microgrid converter is done from MIAS via CAN-bus, power direction as per below.
When in “Sea mode” the converter will be supplying the grid. “Microgrid operation”.
When in “Harbour mode” and shore supply is available it will be used to supply MSB DC. “AFE operation”. Reference signal is calculated by MIAS and sent to converter.
(See 7.1 Ship operational modes)
Wheelhouse backup control: (If MIAS is inoperable)
Started in “Microgrid operation” to power the grid via dedicated switch. For layout of panel see Figure 5 – Wheelhouse backup panel and backup control instruction see 5.9 Blackout recovery.
Local control:
There is also a switch for closing the breaker between converter and transformer, to be closed prior to starting the converter. For interlockings that prevents certain operations of breakers see 5.8.1 Breaker control and interlockings.
Local Grid
Started in “Microgrid operation”.
Local AFE
Not available.
Microgrid
The Microgrid converter is used to generate the onboard grid (400VAC) from MSB DC. 
Output power is limited to transformer/converter maximum.
The hotel load transformer will have continuous temperature monitoring and generate alarms at high temperatures. MIAS will stop the transformer when reaching critically high temperature.
Microgrid control can be done in three ways described below.
Normal control:
Control of the microgrid converter is done from MIAS via CAN-bus as per below.
When in “Sea mode” the converter will be supplying the grid. “Microgrid operation”.
(See 7.1 Ship operational modes)
Wheelhouse backup control: (If MIAS is inoperable)
For interlockings that prevents certain operations of breakers see 5.8.1 Breaker control and interlockings.
Started in “Microgrid operation” to power the grid via dedicated switch. For layout of panel see Figure 5 – Wheelhouse backup panel and backup control instruction see 5.9 Blackout recovery.
Local control:
For interlockings that prevents certain operations of breakers see 5.8.1 Breaker control and interlockings.
Local Grid
Started in “Microgrid operation”.
Shore supply
The shore supply could be used to either only supply the hotel load or both supply the hotel load and charge the batteries via MSB DC.
MIAS controls the shore supply, when to connect and utilize and that limits are followed.
The shore supply will have phase sequence detection for the one 63A connection. 
Shore supply will be provided with an energy meter to keep track of consumed shore power in MIAS.
Shore supply will be provided with a counter that keeps track of the number of connections in MIAS, to keep track of how many times the connector has been used.
When in “Harbour mode” and shore supply is available it will be used to supply the DC.-bus. See 7.1 Ship operational modes.
There are measures taken in the control system to prevent the ship from feeding power to shore.
Regarding Shore supply control and limits also read section 5.3 Microgrid/AFE.
Some functions and safety features are listed below:
The shore supply could be limited to a maximum usable current to cope with a weak shore supply.
Hardwired phase sequence detection by a phase sequence relay.
A hardware safety function is built into the system for: Arc flash protection for the connector. This is performed by a jumper connected to the pilot pin in the connector.
Locally the shore supply safety protection features can be overridden and connected to a non-safe supply.
High-power DC shore supply (Preliminary description)
The high-power DC shore supply is rated at approximately max 400VAC, 750AAC supply to the charger and the physical ship to shore connection is performed by two CCS2 connectors.
The CCS2 standard requires breaking capability, communication, and monitoring of the connector. The ultimate safety of the shore supply connection is managed by the CCS2 charge controller.
MIAS will act as a part in between the batteries and the charging system thus communicating the desired voltage and current etc. to the charge controller.
When connected, “Sea mode” is not available and won´t be available until the High-power DC shore supply have been disconnected again.
Several conditions need to be met before MIAS will allow the high-power charger to be activated. 
The intake is connected without any fault.
Ship operational mode is set to Harbour.
The battery is connected without any fault.
MSB DC Tie breaker is closed.
Emergency stop is not active onboard. 
Emergency stop is not active ashore. 
Activation/deactivation of the shore supply is performed by the operator.
The high-power DC shore supply will be provided with an energy meter to keep track of consumed shore power in MIAS.
The high-power DC shore supply will be provided with a counter that keeps track of the number of connections per connector in MIAS, to keep track of how many times the connectors have been used.
The high-power DC shore supply could be limited to a maximum usable power to manage the battery charging in best way for the batteries, this setting could conflict with the shore side charger if charging according to a calculated timetable is used.
Power Management System
MIAS has integrated functionality for electric power generation and distribution.
The system controls both the DC side by converters and on AC by means of interlocking non-essential consumers. 
Each power source has its own control unit to assure maximum availability, and in conjunction with the self-regulating DC distribution the system is very robust. 
The functionality is controlled and adjusted in the MIAS operating panels.
Functions included in PMS:
Start/stop of genset
Genset will be started and utilized for generating power if there is lack of power, either due to low battery charge or if the batteries are unavailable.
Genset operation 
Genset operation could be activated in both harbour and sea mode, genset will then be started and utilized for powering the grid and to charge the batteries to a predefined battery level (“autostop”).
When the battery has been charged to the predefined level (“autostop”) the genset will be stopped and genset operation deactivated.
Genset operation can be toggled in the operating panel to start/stop the genset.
Autostart/autostop
Setting “autostart” available for choosing at which battery level genset should start. At this level MIAS will automatically activate “genset operation”.
The genset will keep running until the battery level “autostop” is reached or genset operation is stopped by the operator.
(Setting “autostart” can only be set lower than setting “autostop” and setting “autostop” can only be set higher than setting “autostart”).
Harbour mode
Selection if genset should be available as harbour generator. If active the genset will start if the battery level reaches the level in setting “autostart”. This could happen either due to loss of shore connection or if the ship´s consumption is higher than what the shore supply can supply.
Start delay
Setting available for choosing a startup delay on blackout.
Should be set to allow for the system to bring back power via batteries if experiencing a short blackout.
Warming function
Setting available for choosing a warming time, warming load and warming delay. The genset will be loaded with warming load for warming time and not warmed again until warming delay have passed since last operation. 
Stop delay
Setting available for choosing a stop delay.
Delay until unloading the genset.
Cooling time
Setting available for choosing a cooling time.
Delay until stopping the already unloaded genset.
Genset charging
If propulsion is utilized in hybrid operation, genset could be used to charge the batteries. Normally charged from shore supply. On/off selection available.
Genset max load
A max setting for controlling the load of the genset.
Genset will not be loaded to a level higher than this setting.
Energy management
MIAS will act for always having the battery system connected. Monitoring of available energy and alarms at low levels.
Load handling
Load priority and reduction/limitation will be handled by the PMS in the same way as described in section “Self-regulating DC distribution system”. Power limitation will be performed in sequence, battery-charging and propulsion according to available power, if there is an overload situation battery-charging will be limited to allow for propulsion to consume power. The operator can manage the power limitation by moving power consumption from, for instance propulsion to battery-charging by lowering the consumption on propulsion there will be room for battery-charging. Overload situations can occur on both sources, batteries and genset.
Power monitoring including warnings and alarms for low/high-voltage and frequency.
Load shedding (Available but not implemented)
Disconnection of non-essential consumers if the load situation demands it (will happen first after load reduction/limitation is performed and not sufficient).
When the non-essential consumers have been turned off, other consumers like propulsion, etc. can utilize the extra power made available.
Attempt for reconnection when the load situation allows it after adjustable time ”Reconnection time of non-essential loads”.
Reconnection requires power available, (for instance the propulsion power consumption must be lowered to allow for reconnection), the non-essential loads will be reconnected in sequence.
Grid control
Connection and disconnection of microgrids. Only one Microgrid converter will be used simultaneously. To swap from active Microgrid converter to the other Microgrid converter there will be a short blackout.
Grid shore control
Connection and disconnection of shore supply and synchronization between shore and grid, grid and shore are controlled by the PMS.
Shore supply
When changing ship operational mode to “Harbour mode” and the shore supply is available, the shore supply will be synchronized and connected to the transformer. The grid converter will be disconnected as a microgrid converter and instead started as a converter from AC to DC “AFE operation”.
If the shore supply becomes unavailable while connected, the ship will be unpowered for a short while until the AC to DC converter is started as grid converter to supply the grid from DC. Either batteries or the genset will supply AC.
When shore connection is detected again it will be automatically connected again.
Max Battery level
A setting is available to be able to adjust the maximum battery level. By setting a level lower than 100% all charging functions will be stopped at that level instead.
Charging hysteresis
If the batteries have been fully charged the battery level needs to go below a defined level “Charging hysteresis” before charging is allowed again to avoid frequent topping up of the batteries.
Battery emergency operation:
The user could choose to discharge the batteries below a level where the batteries could be damaged beyond repair for more details see section 5.1.1 Battery Utilization. 
Pre-magnetizing and pre-charge
To prevent high inrush current to the DC switchboard or the grid/shore transformer functions are implemented.
Shore supply could be connected to a non-powered ship by the use of pre-magnetizing resistors.
Batteries could be used to power up a non-powered DC switchboard via built in pre-charge function in each string.
Genset could be used to slowly power the DC switchboard. 

The PMS will generate warnings and faults and always act for keeping the power plant alive.

Power distribution
Only one Microgrid converter will be used simultaneously. To swap from active Microgrid converter to the other Microgrid converter there will be a short blackout. Swapping from fwd Microgrid converter to Shore and shore to fwd Microgrid converter will happen without blackout.
Breaker control and interlockings
To prevent unintentional/unwanted situations there are several interlockings and functions incorporated in the design.
Highlighted switching devices in below figure are described below:

Figure 20 – Single line diagram with highlighted switches.
Grid switch (Q1) takes power to control circuits from the incoming supply and can therefore only be closed if its own incoming power is available.
The switch is controllable in both local and remote and backup, backup overrides remote but not local.
The switch can only be closed if MSB AC is unpowered to prevent connection to a non-synchronized power source. Valid for all control.
Grid switch (Q2) takes power to control circuits from the incoming supply and can therefore only be closed if its own incoming power is available.
The switch is controllable in both local and remote and backup, backup overrides remote but not local.
The switch can only be closed if MSB AC is unpowered to prevent connection to a non-synchronized power source. Valid for all control.
Grid converter switch (Q3) takes power to control circuits from batteries and can therefore always be operated.
The switch is controllable in both local and remote and backup, backup overrides remote but not local.
The switch can only be closed if Grid switch (Q2) and Shore supply switch (Q4) are open. Only valid in local and backup control.
MIAS will open the switch if the voltage on MSB DC is too low.
If/when shore switch (Q4) is closed.
MIAS will close and thereafter start the grid converter in sync to the shore supply.
Local grid is not available.
Local AFE is not available.
Shore switch (Q4) takes power to control circuits from the incoming shore power supply and can therefore only be closed if incoming power is available.
The switch is controllable in both local and remote.
The switch has a synchronization relay measuring on both sides of the switch.
The switch can only be closed if Grid switch (Q2) and Grid converter switch (Q3) is open. Only valid in local control.
Pre-charge function will always be activated prior connecting the switch in local control. MIAS will activate the function if needed.
If/when Grid switch (Q2) is closed.
Synchronization is performed by MIAS prior connecting.
Local shore is not available.
If/when Grid converter switch (Q3) is closed.
Synchronization is performed by MIAS prior connecting if needed.
Local shore is not available.
Tie switch (Q5) is locally manually operated and can therefore always be operated.
The switch should never be operated if any side of MSB AC is powered.
Tie switch (Q6) is locally manually operated and can therefore always be operated.
The switch should never be operated if any side of MSB DC is powered.

Blackout recovery
Blackout is detected by continuous monitoring of both AC and DC switchboards by MIAS.
Black start can be performed both by the control system and by local control.
Operator procedure (valid for both procedures): 
Verify that if any consumers are locally controlled, they should be turned off (to not consume power before the cooling system is operable).
Control system procedure (without shore supply):
With batteries available:
Startup battery systems with pre charge functionality.
Startup the 230VAC grid via converter, prioritized consumer is battery and freshwater cooling pump to inverters.
Start freshwater cooling pump.
Start battery cooling pump.
Fully functional, system functionality available.
Without batteries available:
Startup genset to slowly power up MSB DC.
Start the generator converter.
Startup the 230VAC grid via converter, prioritized consumer is battery and freshwater cooling pump to inverters.
Start freshwater cooling pump.
Start battery cooling pump.
Fully functional, system functionality available.
Backup control from wheelhouse:
Not possible to get batteries connected without MIAS communicating with them.
If the batteries are already connected to MSB DC they should be disconnected by emergency stop prior operating the ship in backup control.
Without batteries:
Emergency stop batteries.
Startup genset to slowly power up the MSB DC.
Set genset backup switch in backup.
Set microgrid backup switch in backup (for either fwd or aft converter). 
Start freshwater cooling pump.
Start needed AC consumers.
Set propulsion backup switch in backup to activate the propulsion motor.
In local control (MIAS not available):
Not possible to get batteries connected without MIAS communicating with them.
If the batteries are already connected to MSB DC they should be disconnected by emergency stop prior operating the ship in local control.
Without batteries:
Emergency stop batteries.
Startup genset to slowly power up MSB DC.
Start the generator converter.
Startup the 400VAC grid via converter, prioritized consumer is freshwater cooling pump.
Start freshwater cooling pump.
Start needed AC consumers.
Start propulsion systems.
An unpowered MSB DC may never be connected to an active source of power without pre charge function!
Batteries may never be charged or discharged without MIAS in control of the process therefore batteries cannot be used with local control of any DC sources or consumers!

General control and monitoring
40 I/O:s…
Ship general functions
Ship operational modes
In normal operation of the vessel, the MIAS Controller will directly control and monitor all essential connected equipment. This means that the system can be optimized for energy efficiency within limits and settings set by the crew. The different ship operational modes are as follows:
Harbor mode
In this mode the high-power DC shore supply will be used as prioritized source of power if available.
Secondary the shore supply will be used as prioritized source of power if available.
If both shore supplies are connected at the same time the AC shore supply will be used to supply AC and the high-power DC shore supply will be used to charge the batteries, the microgrid converter will not be used in “AFE operation”.
Batteries are used as the source of power if both shore supplies either are unavailable or becomes unavailable.
If shore connection has been connected and thereafter becomes unavailable the system will try to reconnect again automatically if shore power is detected again.
Depending on setting “Harbour mode genset operation” in PMS, the genset could be available as last source instead of batteries or to recharge the batteries.
Propulsion motors will be blocked.
Sea mode
In this mode batteries are the main source of power.
The genset could be used instead of batteries or to recharge the batteries or in parallel with the batteries.
Shore connection is not available and will be electrically disconnected by MIAS when Sea mode is entered and there is another source of power available for taking over the load.
Propulsion motors will be started automatically when speed references are set to zero.

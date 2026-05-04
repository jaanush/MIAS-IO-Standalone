# Self Regulating PMS Concept

> Converted from Self Regulating PMS concept.docx

Self Regulating PMS

The overall intent of this module is to utilize a common interface to all ship power components and provide a power balancing function without the need to handle special cases and exceptions.
It’s important to note that state changes such as disabling the Genset Controller while on shore power or switching between PTI/PTO or uGrid/AFE are outside the scope of the PMS. These state changes will only affect the PMS by the changing properties of the respective power components.
Every consumer and producer included in the PMS calculation has the following properties:
Min (Kw)
mMin? (Momentaneous Min) (Kw)
Max (Kw)
mMax (Momentaneous Max) (Kw)
Current (Kw)
Setpoint (Kw)
pPrio 0-100)?
cPrio 0-100)?
ROC (Rate of Change in Kw/s)
These traits are dynamic and can only be controlled by the components themselves. This is intended to cover all the special component requirements and quirks including state changes etc.
Producers typically have positive max and min numbers while consumers have negative ones. 
Current is the power consumed or produced by the power component.
Setpoint is the limited power allotment provided by the PMS
cProp (Consumer priority) and pPrio (Provider priority) are value on a fixed scale that influences the balancing algorithm. This can be changed by the component. For example if a consumer requests 500kw but only receives 200 it can increase the priority based on user input.
The ROC property is intended to give the PMS a hint on how fast the component reacts to Setpoint changes. The exact form for this is TBD but might be in the form of kw/s 
Balancing
By summarizing all mMax properties we get the current state of the system. If the result is negative there is a power shortage in the system and there is a need for load limitation.
If the result is positive the providers need to be limited to protect the state of the DC bus.
Limitation for both consumers and providers is calculated based on the uMin, uMax, cPrio, pPrio and ROC.
DC Bus regulation
By adding a PID-controlled factor for DC bus regulation in the balancing equation we can precisely control the Voltage level of the DC bus.
Equalization
The algorithm might have a configurable equalization. If two consumers who’s respective priority values are within a equalization window and the there is not enough available power to fulfill the needs of both consumers, the distribution can be equalized.
Example: Cons1 requests 100Kw with cPrio 50 and Cons2 requests 50Kw with a cPrio of 48. The available power is 80Kw. Without equalization Cons1 would get all of the 80Kw and Cons2 will get 0Kw. With equalization where both consumers are within the equalization window Cons1 might get 60Kw and Cons2 20Kw.
The equalization is calculated with a priority window size which determines which consumers are affected and a power setting which determines the amount of equalization.
Prioritization
Priorities are calculated internally by the respective components based on predefined rules and values. Each component has a base prioritization and health span that is calculated during runtime. During runtime a further configuration offset can be added. These are then summarized and reported back to the PMS as the priority.
Priority influences
Priority is influenced by both the actors local properties and external influences. This results in some ambiguity concerning the ownership of the priority data. A valid concern is that priority should be decided on a level where the full scope is accessible, disqualifying the notion that all actors decide their own priority. At the same time it would be beneficial to include the actor state in the priority calculation. There for the actor should be able to provide upstream components with a state metric that may or may not be used in the final priority calculation.
Local
Base Actor type preset (shipmode list)
Actor State (In a span set in configuration)
External

Shipmode
User configuration (shipmode list, Overrides System Configuration)
System Configuration (shipmode list, overrides Base Actor type preset)
Examples
Some example settings for power components to verify the interface
Genset
Typically the genset is defined as a producer with positive provider numbers. Note that the spinning reserve is used by the Genset component to automatically provide up to Max.
Min: 0
Max: Total capacity in Kw (>0)
mMin: Same as Min
mMax: Typically the currently provided power + current spinning reserve (>0)
Currently produced (>0)
Setpoint from PMS (>0)
pPrio: typically lower than battery priority
cPrio: 0
ROC: Max rate of change for the Momentary load in Kw/s. Calculated from all gensets included in MMax that have spare capacity
The genset controller typically starts up with a MMax of 0 that will increase as more gensets come online. Speed is typically dependent on either the ability for the regulator to increase the load provided the RPM is sufficient or the speed of which RPM can be ramped up.
Battery
Batteries can be both providers and consumers. Batteries typically have a high Provider priority but a low consumer priority.
Max: Maximum Kw the batteries can provide (>0)
Min: Maximum rate of charge the battery can charge(<0)
MMin: same as Min
MMax: Same as Max
Currently provided/consumed Kw
Setpoint from PMS (>0 for discharge, <0 for charge)
pPrio: Typically between Shore charging stations and Genset
cProp: Typically one of the lowest
ROC: Typically very high.
If batteries are fully charged the Min and mMin are zero to disable charging by the PMS. Special cases such as DC bus Power Spike compensation will be handled by the battery component by temporary changing the mMin/mMax values.
Engine
Various electric engines such as Propulsion or Thrusters.
Max: 0
Min: Power requested for current operation <0
mMax: Same as Max
mMin: Same as Min
Current: Currently consumed Kw
Setpoint: Allocated power from PMS (<0)
cPrio: 0-100
pPrio: 0
ROC: Typically very high.
uGrid/AFE
The uGrid/AFE can be both consumer and provider. State transfer Is handled internally.
Max: >0 in uGrid mode, 0 in AFE mode
Min : <0 in AFE mode, same as Max in uGrid mode (Hotel load)
mMax: Same as Max
mMin: Same as Min
Current: Currently provided/consumed Kw
Setpoint from PMS (>=0 for AFE, <=0 for uGrid)
cPrio: Very high
pPrio: Very high but below Shore DC?
ROC: Moderate in uGrid, high in AFE
PTI/PTO
The PTI/PTO Can be both consumer and provider. State transfer Is handled internally.
Max: >0 in PTI, 0 in PTO
Min: <0 in PTO, 0 in PTI
mMax: Same as Max
mMin: Same as Min
Current: Currently provided/consumed Kw
Setpoint from PMS (>=0 for PTI, <=0 for PTO)
cPrio: Depends on Mode 
pPrio: Depends on Mode
ROC: Typically quite low?
DC Shore Connection
Max: >0
Min: 0
mMax: Same as Max
mMin: Same as Min
Current: Currently provided Kw
Setpoint from PMS >0
cPrio: 0 
pPrio: Very high 


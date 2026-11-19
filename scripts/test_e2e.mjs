#!/usr/bin/env node
/**
 * scripts/test_e2e.mjs
 * 
 * Prueba End-to-End (E2E) completa contra la instancia REAL de Supabase
 * para el flujo de cuidador en PillSync IoT (front-pastillero).
 * 
 * Flujo validado:
 *   1. Registro / Creación de usuario y verificación del TRIGGER on_auth_user_created -> public.cuidadores.
 *   2. Autenticación con cliente público (ANON KEY) para validar RLS estricto.
 *   3. Vinculación de dispositivo IoT (MAC: 11:22:33:44:55:66) mediante UPSERT en public.dispositivos.
 *   4. Re-lectura del dispositivo por cuidador_id (detección de estado).
 *   5. CRUD completo en public.horarios (INSERT, SELECT, UPDATE, DELETE).
 *   6. Registro y lectura en public.historial_tomas (evento 'dispensado') y actualización de pastillas_restantes.
 *   7. Limpieza (Cleanup) de registros de prueba y usuario.
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createClient } from '@supabase/supabase-js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const projectRoot = path.resolve(__dirname, '..');

// ── 1. Cargar variables de entorno desde .env.local o .env ──────────────────────
function loadEnv() {
  const envFiles = [
    path.join(projectRoot, '.env.local'),
    path.join(projectRoot, '.env'),
  ];

  for (const file of envFiles) {
    if (fs.existsSync(file)) {
      const content = fs.readFileSync(file, 'utf8');
      for (const line of content.split('\n')) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx !== -1) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          if (!process.env[key]) {
            process.env[key] = val;
          }
        }
      }
    }
  }
}

loadEnv();

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL || '';
const SUPABASE_ANON_KEY = process.env.VITE_SUPABASE_ANON_KEY || process.env.SUPABASE_ANON_KEY || '';
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || '';

const TEST_EMAIL = process.env.TEST_USER_EMAIL || `e2e_test_${Date.now()}@pillsync-iot.test`;
const TEST_PASSWORD = process.env.TEST_USER_PASSWORD || 'PillSyncE2E_2026!';
const TEST_NOMBRE = 'Cuidador Test E2E Automatizado';
const TEST_MAC = '11:22:33:44:55:66';

// ── Utilidades de consola ───────────────────────────────────────────────────────
const colors = {
  reset: '\x1b[0m',
  bright: '\x1b[1m',
  dim: '\x1b[2m',
  green: '\x1b[32m',
  red: '\x1b[31m',
  yellow: '\x1b[33m',
  cyan: '\x1b[36m',
  blue: '\x1b[34m',
  gray: '\x1b[90m',
};

const pass = (msg) => console.log(`  ${colors.green}✔ PASS:${colors.reset} ${msg}`);
const fail = (msg, err) => {
  console.log(`  ${colors.red}✖ FAIL:${colors.reset} ${msg}`);
  if (err) console.log(`    ${colors.red}Detalle:${colors.reset}`, err);
};
const info = (msg) => console.log(`  ${colors.cyan}ℹ INFO:${colors.reset} ${msg}`);
const step = (num, title) => console.log(`\n${colors.bright}${colors.blue}[PASO ${num}]${colors.reset} ${colors.bright}${title}${colors.reset}`);

// ── Ejecución Principal ─────────────────────────────────────────────────────────
async function runE2ETests() {
  console.log('\n' + '═'.repeat(72));
  console.log(`${colors.bright}${colors.cyan}   PILLSYNC IoT — SUITE DE PRUEBAS END-TO-END (E2E) EN VIVO${colors.reset}`);
  console.log('═'.repeat(72));
  console.log(` Instancia: ${colors.yellow}${SUPABASE_URL || '(No configurada)'}${colors.reset}`);
  console.log(` Modo Auth: ${SUPABASE_SERVICE_ROLE_KEY ? colors.green + 'Admin Service Role + Anon RLS' : colors.yellow + 'Solo Anon Key (Public Sign-Up)'}${colors.reset}`);
  console.log(` Usuario  : ${colors.dim}${TEST_EMAIL}${colors.reset}`);
  console.log(` MAC Test : ${colors.dim}${TEST_MAC}${colors.reset}`);
  console.log('═'.repeat(72));

  // Validación de credenciales reales
  const isPlaceholderUrl = !SUPABASE_URL || 
                           SUPABASE_URL.includes('tu-proyecto') || 
                           SUPABASE_URL.includes('placeholder');
  
  const isValidAnonKey = SUPABASE_ANON_KEY &&
                         (SUPABASE_ANON_KEY.startsWith('eyJ') || SUPABASE_ANON_KEY.startsWith('sb_publishable_')) &&
                         !SUPABASE_ANON_KEY.includes('PEGA_AQUI') &&
                         !SUPABASE_ANON_KEY.includes('tu-anon-key');

  if (isPlaceholderUrl || !isValidAnonKey) {
    console.log(`\n${colors.red}${colors.bright}❌ ERROR DE AUTENTICACIÓN (Clave API inválida):${colors.reset}`);
    if (!isValidAnonKey) {
      console.log(`VITE_SUPABASE_ANON_KEY no es válida ('${SUPABASE_ANON_KEY}').`);
      console.log(`Debe ser una clave Publishable ('sb_publishable_...') o JWT ('eyJ...').`);
    }
    process.exit(1);
  }

  const hasValidServiceRole = Boolean(
    SUPABASE_SERVICE_ROLE_KEY &&
    (SUPABASE_SERVICE_ROLE_KEY.startsWith('eyJ') || SUPABASE_SERVICE_ROLE_KEY.startsWith('sb_secret_')) &&
    !SUPABASE_SERVICE_ROLE_KEY.includes('PEGA_AQUI')
  );

  let adminClient = null;
  if (hasValidServiceRole) {
    adminClient = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY, {
      auth: { persistSession: false, autoRefreshToken: false },
    });
  }

  // Cliente público que pasará 100% por RLS
  const anonClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });

  let userId = null;
  let testDeviceId = null;
  let testScheduleId = null;
  let testHistoryId = null;
  let passedCount = 0;
  let failedCount = 0;

  try {
    // ══════════════════════════════════════════════════════════════════════════
    // PASO 1: Creación de usuario y verificación del TRIGGER on_auth_user_created
    // ══════════════════════════════════════════════════════════════════════════
    step(1, 'Registro de usuario y verificación de TRIGGER en public.cuidadores');

    if (adminClient) {
      info('Creando usuario con auth.admin.createUser (email_confirm: true para evitar rate limits)...');
      const { data: createData, error: createErr } = await adminClient.auth.admin.createUser({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        email_confirm: true,
        user_metadata: {
          nombre: TEST_NOMBRE,
          telefono: '+52 55 1234 5678',
        },
      });

      if (createErr) {
        throw new Error(`Error en admin.createUser: [${createErr.status}] ${createErr.message}`);
      }
      userId = createData.user.id;
      pass(`Usuario creado exitosamente vía Admin API. UID: ${userId}`);
    } else {
      info('Creando usuario con anonClient.auth.signUp...');
      const { data: signData, error: signErr } = await anonClient.auth.signUp({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
        options: {
          data: {
            nombre: TEST_NOMBRE,
            telefono: '+52 55 1234 5678',
          },
        },
      });

      if (signErr) {
        throw new Error(`Error en auth.signUp: [${signErr.status}] ${signErr.message}`);
      }
      userId = signData.user?.id;
      if (!userId) {
        throw new Error('signUp no retornó un usuario válido.');
      }
      pass(`Usuario registrado exitosamente. UID: ${userId}`);
    }

    // Iniciar sesión con el cliente público para obtener JWT y someterse a RLS
    info('Iniciando sesión con anonClient.auth.signInWithPassword...');
    const { data: authSession, error: loginErr } = await anonClient.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (loginErr) {
      throw new Error(`Error iniciando sesión con anonClient: [${loginErr.status}] ${loginErr.message}`);
    }
    pass(`Sesión pública iniciada. Token JWT asignado al cliente.`);

    // Verificar que el Trigger on_auth_user_created insertó la fila en 'public.cuidadores'
    info('Esperando ejecución del TRIGGER on_auth_user_created en public.cuidadores...');
    let cuidadorProfile = null;
    for (let attempt = 1; attempt <= 6; attempt++) {
      await new Promise((r) => setTimeout(r, 800));
      const { data, error } = await anonClient
        .from('cuidadores')
        .select('*')
        .eq('id', userId)
        .maybeSingle();

      if (!error && data) {
        cuidadorProfile = data;
        break;
      }
    }

    if (!cuidadorProfile) {
      throw new Error(`El trigger on_auth_user_created no creó el registro en 'public.cuidadores' tras varios reintentos.`);
    }

    if (cuidadorProfile.email !== TEST_EMAIL) {
      throw new Error(`El email en cuidadores (${cuidadorProfile.email}) no coincide con el esperado (${TEST_EMAIL}).`);
    }

    pass(`Trigger verificado: Perfil encontrado en 'cuidadores' (nombre: "${cuidadorProfile.nombre}", email: "${cuidadorProfile.email}").`);
    passedCount++;

    // ══════════════════════════════════════════════════════════════════════════
    // PASO 2: Vinculación de dispositivo IoT vía UPSERT (onConflict: 'mac_id')
    // ══════════════════════════════════════════════════════════════════════════
    step(2, `Vinculación de MAC (${TEST_MAC}) mediante UPSERT en public.dispositivos`);

    const { data: upsertData, error: upsertErr } = await anonClient
      .from('dispositivos')
      .upsert(
        {
          mac_id: TEST_MAC,
          cuidador_id: userId,
          nombre: 'Dispensador Inteligente Sala',
          pastillas_restantes: 30,
          capacidad_maxima: 30,
          estado: 'online',
          ultima_conexion: new Date().toISOString(),
        },
        { onConflict: 'mac_id' }
      )
      .select();

    if (upsertErr) {
      throw new Error(`Error en UPSERT public.dispositivos [${upsertErr.code}]: ${upsertErr.message}`);
    }

    if (!upsertData || upsertData.length === 0) {
      throw new Error(`El UPSERT no retornó filas (posible bloqueo de RLS por dispositivo ajeno).`);
    }

    const boundDevice = upsertData[0];
    testDeviceId = boundDevice.id;
    pass(`Dispositivo vinculado con éxito. ID: ${testDeviceId}, MAC: ${boundDevice.mac_id}, Stock: ${boundDevice.pastillas_restantes}`);
    passedCount++;

    // 2.1 Caso de borde: Intentar vincular la misma MAC desde OTRA cuenta de cuidador
    if (adminClient) {
      info('2.1 Verificando protección RLS: Intentar vincular la misma MAC desde otra cuenta...');
      const otherEmail = `intruder_${Date.now()}@pillsync-test.io`;
      const { data: otherUserData } = await adminClient.auth.admin.createUser({
        email: otherEmail,
        password: TEST_PASSWORD,
        email_confirm: true,
      });

      const otherClient = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: { persistSession: false, autoRefreshToken: false },
      });
      await otherClient.auth.signInWithPassword({ email: otherEmail, password: TEST_PASSWORD });

      const { data: hijackAttempt, error: hijackErr } = await otherClient
        .from('dispositivos')
        .upsert(
          {
            mac_id: TEST_MAC,
            cuidador_id: otherUserData.user.id,
            nombre: 'Dispositivo Secuestrado',
            pastillas_restantes: 10,
          },
          { onConflict: 'mac_id' }
        )
        .select();

      const blockedByRls = hijackErr?.code === '42501' || !hijackAttempt || hijackAttempt.length === 0;
      if (!blockedByRls) {
        throw new Error('Fallo de seguridad RLS: Otro usuario pudo sobreescribir un dispositivo ya vinculado.');
      }

      pass('Protección RLS confirmada: Otro cuidador no puede vincular una MAC ya asignada ("Este dispositivo ya está vinculado a otra cuenta").');
      passedCount++;

      // Limpiar usuario intruso
      await adminClient.auth.admin.deleteUser(otherUserData.user.id);
    }

    // ══════════════════════════════════════════════════════════════════════════
    // PASO 3: Detección de estado (Re-lectura de dispositivos por cuidador_id)
    // ══════════════════════════════════════════════════════════════════════════
    step(3, 'Detección de estado del cuidador (SELECT dispositivos WHERE cuidador_id = user.id)');

    const { data: userDevices, error: devQueryErr } = await anonClient
      .from('dispositivos')
      .select('*')
      .eq('cuidador_id', userId);

    if (devQueryErr) {
      throw new Error(`Error consultando dispositivos: ${devQueryErr.message}`);
    }

    const foundDevice = userDevices.find((d) => d.mac_id === TEST_MAC);
    if (!foundDevice) {
      throw new Error(`No se encontró el dispositivo con MAC ${TEST_MAC} asociado al cuidador ${userId}.`);
    }

    pass(`Detección de estado exitosa: Cuidador tiene ${userDevices.length} dispositivo(s). El frontend entraría directo al Dashboard.`);
    passedCount++;

    // ══════════════════════════════════════════════════════════════════════════
    // PASO 4: CRUD completo en public.horarios
    // ══════════════════════════════════════════════════════════════════════════
    step(4, 'CRUD completo en public.horarios (INSERT, SELECT, UPDATE, DELETE)');

    // 4.1 INSERT
    info('4.1 Creando horario programado (INSERT)...');
    const { data: createdSched, error: schedInsErr } = await anonClient
      .from('horarios')
      .insert({
        dispositivo_id: testDeviceId,
        mac_id: TEST_MAC,
        hora_programada: '08:30:00',
        estado: 'activo',
        medicamento: 'Ibuprofeno 400mg',
        dosis: '1 comprimido',
        dias: ['L', 'M', 'X', 'J', 'V'],
        notas: 'Tomar después del desayuno con abundante agua',
      })
      .select()
      .single();

    if (schedInsErr) {
      throw new Error(`Error creando horario: ${schedInsErr.message}`);
    }
    testScheduleId = createdSched.id;
    pass(`Horario creado. ID: ${testScheduleId}, Hora: ${createdSched.hora_programada}, Med: ${createdSched.medicamento}`);

    // 4.2 SELECT
    info('4.2 Consultando lista de horarios del dispositivo (SELECT)...');
    const { data: listScheds, error: schedSelErr } = await anonClient
      .from('horarios')
      .select('*')
      .or(`mac_id.eq.${TEST_MAC},dispositivo_id.eq.${testDeviceId}`)
      .order('hora_programada', { ascending: true });

    if (schedSelErr) {
      throw new Error(`Error listando horarios: ${schedSelErr.message}`);
    }
    const schedFound = listScheds.some((s) => s.id === testScheduleId);
    if (!schedFound) {
      throw new Error(`El horario recién creado no aparece en la consulta de horarios.`);
    }
    pass(`Lectura de horarios correcta: ${listScheds.length} horario(s) cargado(s).`);

    // 4.3 UPDATE (Alternar estado de activo a inactivo)
    info('4.3 Modificando horario (UPDATE: alternar estado a inactivo)...');
    const { data: updatedSched, error: schedUpdErr } = await anonClient
      .from('horarios')
      .update({
        estado: 'inactivo',
        dosis: '2 comprimidos',
      })
      .eq('id', testScheduleId)
      .select()
      .single();

    if (schedUpdErr) {
      throw new Error(`Error modificando horario: ${schedUpdErr.message}`);
    }
    if (updatedSched.estado !== 'inactivo' || updatedSched.dosis !== '2 comprimidos') {
      throw new Error(`Los valores modificados del horario no coinciden.`);
    }
    pass(`Horario actualizado con éxito (nuevo estado: ${updatedSched.estado}, nueva dosis: ${updatedSched.dosis}).`);

    // 4.4 DELETE
    info('4.4 Eliminando horario (DELETE)...');
    const { error: schedDelErr } = await anonClient
      .from('horarios')
      .delete()
      .eq('id', testScheduleId);

    if (schedDelErr) {
      throw new Error(`Error eliminando horario: ${schedDelErr.message}`);
    }

    const { data: verifyDeleted } = await anonClient
      .from('horarios')
      .select('*')
      .eq('id', testScheduleId);

    if (verifyDeleted && verifyDeleted.length > 0) {
      throw new Error(`El horario no fue eliminado correctamente de la base de datos.`);
    }
    testScheduleId = null;
    pass('Horario eliminado y confirmado correctamente.');
    passedCount++;

    // ══════════════════════════════════════════════════════════════════════════
    // PASO 5: Historial de tomas y actualización de stock (pastillas_restantes)
    // ══════════════════════════════════════════════════════════════════════════
    step(5, 'Historial de tomas (INSERT, SELECT) y actualización de stock');

    // 5.1 INSERT evento en historial_tomas
    info('5.1 Registrando evento de dispensación en public.historial_tomas...');
    const { data: histRecord, error: histInsErr } = await anonClient
      .from('historial_tomas')
      .insert({
        dispositivo_id: testDeviceId,
        mac_id: TEST_MAC,
        evento: 'dispensado',
        detalles: 'Dispensación ejecutada con éxito. Sensor óptico confirmó caída del comprimido.',
        medicamento: 'Ibuprofeno 400mg',
        dosis: '1 comprimido',
      })
      .select()
      .single();

    if (histInsErr) {
      throw new Error(`Error insertando en historial_tomas: ${histInsErr.message}`);
    }
    testHistoryId = histRecord.id;
    pass(`Evento registrado en historial. ID: ${testHistoryId}, Evento: ${histRecord.evento}`);

    // 5.2 SELECT en historial_tomas
    info('5.2 Consultando historial de tomas del dispositivo...');
    const { data: histList, error: histSelErr } = await anonClient
      .from('historial_tomas')
      .select('*')
      .or(`mac_id.eq.${TEST_MAC},dispositivo_id.eq.${testDeviceId}`)
      .order('created_at', { ascending: false });

    if (histSelErr) {
      throw new Error(`Error consultando historial_tomas: ${histSelErr.message}`);
    }
    if (!histList || !histList.some((h) => h.id === testHistoryId)) {
      throw new Error('El evento insertado no se encontró en la consulta del historial.');
    }
    pass(`Historial consultado exitosamente: ${histList.length} evento(s) encontrado(s).`);

    // 5.3 UPDATE de pastillas_restantes en dispositivos (reducir stock)
    info('5.3 Descontando stock en public.dispositivos (pastillas_restantes: 30 -> 29)...');
    const { data: updatedDev, error: stockErr } = await anonClient
      .from('dispositivos')
      .update({ pastillas_restantes: 29 })
      .eq('mac_id', TEST_MAC)
      .select()
      .single();

    if (stockErr) {
      throw new Error(`Error actualizando pastillas_restantes: ${stockErr.message}`);
    }
    if (updatedDev.pastillas_restantes !== 29) {
      throw new Error(`El conteo de pastillas no se actualizó como se esperaba (esperado: 29, obtenido: ${updatedDev.pastillas_restantes}).`);
    }
    pass(`Stock de pastillas actualizado correctamente: 29 pastillas restantes.`);
    passedCount++;

    // ══════════════════════════════════════════════════════════════════════════
    // PASO 6: Cierre de sesión y re-ingreso (Persistencia y recuperación de estado)
    // ══════════════════════════════════════════════════════════════════════════
    step(6, 'Cierre de sesión (signOut) y re-ingreso (signInWithPassword)');

    info('6.1 Cerrando sesión del cuidador...');
    await anonClient.auth.signOut();
    const { data: sessionAfterSignOut } = await anonClient.auth.getSession();
    if (sessionAfterSignOut?.session) {
      throw new Error('La sesión no se cerró correctamente.');
    }
    pass('Sesión cerrada con éxito. Estado local purgado.');

    info('6.2 Re-iniciando sesión con las credenciales del cuidador...');
    const { data: reLoginData, error: reLoginErr } = await anonClient.auth.signInWithPassword({
      email: TEST_EMAIL,
      password: TEST_PASSWORD,
    });

    if (reLoginErr) {
      throw new Error(`Error en re-ingreso: ${reLoginErr.message}`);
    }
    pass(`Re-autenticado con éxito como ${reLoginData.user.email}`);

    info('6.3 Comprobando recuperación directa del dispositivo vinculado...');
    const { data: reloadedDevs, error: reloadErr } = await anonClient
      .from('dispositivos')
      .select('*')
      .eq('cuidador_id', reLoginData.user.id);

    if (reloadErr || !reloadedDevs || reloadedDevs.length === 0) {
      throw new Error('Al re-ingresar no se pudo recuperar el dispositivo vinculado.');
    }
    pass(`Dispositivo recuperado de inmediato (${reloadedDevs[0].nombre}, stock: ${reloadedDevs[0].pastillas_restantes}). No vuelve a pedir MAC.`);
    passedCount++;

  } catch (error) {
    fail('Excepción o fallo detectado durante la prueba E2E', error.message || error);
    failedCount++;
  } finally {
    // ══════════════════════════════════════════════════════════════════════════
    // PASO 7: Limpieza (Cleanup)
    // ══════════════════════════════════════════════════════════════════════════
    step(7, 'Limpieza preventiva (Cleanup) de registros de prueba');

    try {
      // Limpiar horarios creados si alguno quedó pendiente
      if (testDeviceId || TEST_MAC) {
        await anonClient.from('horarios').delete().eq('mac_id', TEST_MAC);
        info(`Horarios de prueba eliminados para MAC ${TEST_MAC}.`);
      }

      // Limpiar historial
      if (testDeviceId || TEST_MAC) {
        await anonClient.from('historial_tomas').delete().eq('mac_id', TEST_MAC);
        info(`Historial de prueba eliminado para MAC ${TEST_MAC}.`);
      }

      // Limpiar dispositivo de prueba
      if (testDeviceId || TEST_MAC) {
        await anonClient.from('dispositivos').delete().eq('mac_id', TEST_MAC);
        info(`Dispositivo de prueba eliminado para MAC ${TEST_MAC}.`);
      }

      // Limpiar cuidador y usuario de prueba si se cuenta con adminClient
      if (adminClient && userId) {
        // Eliminar fila en cuidadores por si el FK no tiene ON DELETE CASCADE
        await adminClient.from('cuidadores').delete().eq('id', userId);
        const { error: delUserErr } = await adminClient.auth.admin.deleteUser(userId);
        if (delUserErr) {
          info(`No se pudo eliminar el usuario de prueba de auth.users: ${delUserErr.message}`);
        } else {
          pass(`Usuario de prueba (${userId}) eliminado de auth.users.`);
        }
      }
    } catch (cleanupErr) {
      info(`Nota en cleanup: ${cleanupErr.message}`);
    }

    // ── Resumen Final ───────────────────────────────────────────────────────
    console.log('\n' + '═'.repeat(72));
    console.log(`${colors.bright}RESUMEN DE PRUEBAS E2E:${colors.reset}`);
    console.log(`  Pruebas superadas : ${colors.green}${colors.bright}${passedCount}${colors.reset}`);
    console.log(`  Pruebas fallidas  : ${failedCount === 0 ? colors.green : colors.red}${colors.bright}${failedCount}${colors.reset}`);
    console.log('═'.repeat(72));

    if (failedCount === 0 && passedCount > 0) {
      console.log(`\n${colors.green}${colors.bright}🎉 ¡ÉXITO TOTAL! El 100% del flujo del cuidador pasó en verde contra Supabase.${colors.reset}\n`);
      process.exit(0);
    } else {
      console.log(`\n${colors.red}${colors.bright}💥 Hubo fallos en el flujo E2E. Revisa los detalles anteriores.${colors.reset}\n`);
      process.exit(1);
    }
  }
}

runE2ETests();

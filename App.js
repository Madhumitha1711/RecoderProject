import * as React from 'react';
import {
  Dimensions,
  Image,
  Slider, TouchableHighlight,
  Text, View, StyleSheet, FlatList, SafeAreaView, TouchableOpacity, TextInput
} from 'react-native';
import { Button, Card } from 'react-native-paper';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { Colors } from 'react-native/Libraries/NewAppScreen';
import { green } from 'ansi-colors';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';

const Stack = createNativeStackNavigator()

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator screenOptions={{ headerStyle: { backgroundColor: '#ffcc99' } }}>
        <Stack.Screen name="RECORDER" component={HomeScreen} />
      </Stack.Navigator>
    </NavigationContainer>
  );
}

function HomeScreen() {
  const [recording, setRecording] = React.useState();
  const [filesList, setFileList] = React.useState([{}]);
  const [fileName, setFileName] = React.useState();
  const [sound, setSound] = React.useState();
  const [isRecording, setIsRecording] = React.useState(false);
  const [recordingDuration, setRecordingDuration] = React.useState(0);
  const [metering, setMetering] = React.useState(0);
  const [threshold, setThreshold] = React.useState(90);
  const [compress, setCompress] = React.useState(4);




  const [recordingSettings, setRecordingSettings] = React.useState(Audio.RECORDING_OPTIONS_PRESET_HIGH_QUALITY);


  React.useEffect(() => {
    console.log("In useeffect");
    getFileList();
    return sound
      ? () => {
        console.log('Unloading Sound');
        sound.unloadAsync();
      }
      : undefined;
  }, [getFileList, sound])

  const getFileList = React.useCallback(async () => {
    let list = [];
    let dir = await FileSystem.readDirectoryAsync(FileSystem.documentDirectory);
    dir.forEach((val) => {
      let path = FileSystem.documentDirectory + val
      let soundObj = new Audio.Sound();
      soundObj.loadAsync({ uri: path }).then((obj) => {
        soundObj.getStatusAsync().then((statusSound) => {
          FileSystem.getInfoAsync(path).then((info) => {
            list.push({ id: val, pathF: path, name: val, duration: getMMSSFromMillis(statusSound.durationMillis), ts: info.modificationTime });
            setFileList(list);
            console.log("file List-->" + JSON.stringify(filesList));

          })
        })
      }
      );
    });
  }, [])



  updateScreenForRecordingStatus = (status) => {
    if (status.canRecord) {
      setRecordingDuration(status.durationMillis);
      setIsRecording(status.isRecording);
      console.log("Meteringval-->" + status.metering);
      setMetering(status.metering);


    } else if (status.isDoneRecording) {
      setRecordingDuration(0),
        setIsRecording(false);
      setMetering(status.metering);
    };
  }

  async function startRecording() {
    try {
      console.log('Requesting permissions..');
      await Audio.requestPermissionsAsync();
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });
      console.log('Starting recording..');
      const recording = new Audio.Recording();
      await recording.prepareToRecordAsync(recordingSettings);
      recording.setOnRecordingStatusUpdate(updateScreenForRecordingStatus);
      setRecording(recording);
      console.log('Recording started');
      await recording.startAsync();
    } catch (err) {
      console.error('Failed to start recording', err);
    }
  }

  function getRecordingTimestamp() {
    console.log("e Insid getRecordingTimestamp-->" + getMMSSFromMillis(recordingDuration))
    if (recordingDuration != null) {
      return getMMSSFromMillis(recordingDuration);
    }
    return getMMSSFromMillis(0);
  }
  function getMMSSFromMillis(millis) {

    console.log("millies--->" + millis)
    const totalSeconds = millis / 1000;
    const seconds = Math.floor(totalSeconds % 60);
    const minutes = Math.floor(totalSeconds / 60);

    const padWithZero = (number) => {
      const string = number.toString();
      if (number < 10) {
        return "0" + string;
      }
      return string;
    };
    return padWithZero(minutes) + ":" + padWithZero(seconds);
  }
  async function stopRecording() {
    console.log('Stopping recording..');
    await setFileName("");
    await setRecordingDuration(null);
    await setRecording(undefined);
    await recording.stopAndUnloadAsync();
    const extension = Platform.OS === 'android' ? '.m4a' : '.caf'
    const uri = recording.getURI();
    const newFileUri = FileSystem.documentDirectory + fileName + extension;
    console.log('Recording stopped and stored at', uri);
    console.log('document dir :' + newFileUri);
    FileSystem.copyAsync({
      from: uri,
      to: newFileUri,
    }).then(() => {
      FileSystem.getInfoAsync(newFileUri, { size: true }).then(
        (asset) => {
          if (asset.exists) {
            console.log('file saved from asset. . . : ', asset)
          }
        });
      getFileList();
    })
  }
  const renderItem = ({ item }) => (
    <Item title={item.name} path={item.pathF} duration={item.duration} />
  );

  async function playSound(path) {
    console.log("Inside play sound-->" + path);
    console.log('Loading Sound');
    const { sound } = await Audio.Sound.createAsync(
      { uri: path }
    );
    setSound(sound);

    console.log('Playing Sound');
    await sound.playAsync();
  }

  async function stopSound() {
    await sound.stopAsync();
  }

  async function pauseSound() {
    await sound.pauseAsync();
  }

  async function deleteFile(path) {
    let fs = filesList.filter(f => f.pathF != path);
    setFileList(fs);
    await FileSystem.deleteAsync(path);
    getFileList();
  }

  async function shareFile(path) {
    if (!(await Sharing.isAvailableAsync())) {
      alert(`Uh oh, sharing isn't available on your platform`);
      return;
    }

    await Sharing.shareAsync(path);
  }

  const Item = ({ title, path, duration }) => (
    title ? <Card style={{ margin: 2, backgroundColor: "#ffe6cc" }}>
      <View style={{ flexDirection: 'row', alignItems: "center", justifyContent: "space-between" }}>
        <TouchableOpacity onPress={() => playSound(path)} style={{ flex: 1 }}>
          <View style={styles.item}>
            <Text style={{ fontSize: 18 }}>{title}</Text>
          </View>
        </TouchableOpacity>
        <TouchableOpacity>
          <Text>{duration}</Text>
        </TouchableOpacity>
        <Button icon="stop" labelStyle={{ fontSize: 35, color: "#ff471a" }}
          onPress={stopSound} />

        <Button icon="trash-can" labelStyle={{ fontSize: 35, color: "green" }} onPress={() => deleteFile(path)} />

        <Button icon="share" labelStyle={{ fontSize: 35, color: "#99e6ff" }} onPress={() => shareFile(path)} />

      </View>
    </Card> : <View />

  );

  function sortedFileList() {
    if (filesList.length > 0) {
      return filesList.sort(function (a, b) {
        return b.ts - a.ts;
      })
    }
    else {
      return []
    }
  }

  return (
    <SafeAreaView style={styles.container}>
      <View style={{ display: "flex", flexDirection: 'row', alignContent: "center", justifyContent: "space-between", marginTop: 20 }}>
        <View style={{ borderWidth: 1, borderColor: '#e67300', flex: 1 }}>
          <TextInput
            placeholder="Enter Audio name"
            editable
            maxLength={40}
            onChangeText={text => setFileName(text)}
            value={fileName}
            style={{ padding: 10, color: "#e67300" }}
          />
        </View>
        <View style={{ flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
          <View>
            <Button
              style={{ marginLeft: 20 }}
              labelStyle={{ fontSize: 35, color: fileName ? recording ? "red" : "green" : "grey" }}
              icon="microphone"
              onPress={recording ? stopRecording : startRecording}
              disabled={fileName ? false : true}
            />
          </View>
          <View>
            <Text style={{ fontSize: 18, color: 'red' }}>{getRecordingTimestamp()}</Text>
          </View>
        </View>
      </View>

      <View style={{ marginTop: 10, flexDirection: 'row' }}>
        <Text style={{ fontSize: 18, color: 'black' }} >dbFS :</Text>
        <Text style={{ fontSize: 18, color: '#e67300' }} > {metering}</Text>
      </View>

      <View style={{ paddingVertical: 10 }}>
        <View style={{ marginTop: 10, flexDirection: 'row' }}>

          <Text style={{ fontSize: 18 }}>Threshold Value :</Text>
          <Text style={{ fontSize: 18, color: '#e67300' }}>{threshold}</Text>
        </View>
        <Slider value={threshold}
          onValueChange={(value) => setThreshold(value)}
          minimumValue={10}
          maximumValue={100}
          step={1}
          thumbTintColor="#e67300"
          minimumTrackTintColor="#e67300"
          trackStyle={{ height: 50 }}
        />
      </View>

      <View style={{ paddingTop: 10, paddingBottom: 20 }}>
        <View style={{ marginTop: 10, flexDirection: 'row' }}>

          <Text style={{ fontSize: 18 }}>Compress Level :</Text>
          <Text style={{ fontSize: 18, color: '#e67300' }}>{compress}</Text>
        </View>
        <Slider value={compress}
          onValueChange={(value) => setCompress(value)}
          minimumValue={1}
          maximumValue={10}
          step={1}
          thumbTintColor="#e67300"
          minimumTrackTintColor="#e67300"
          trackStyle={{ height: 50 }}
        />
      </View>


      <View style={{ height: 300 }}>
        {filesList.length > 0 && <FlatList
          data={sortedFileList()}
          renderItem={renderItem}
          keyExtractor={(item, index) => { return item.ts+'' }}

        />}
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'flex-start',
    backgroundColor: '#ecf0f1',
    padding: 10,
  },
  item: {
    padding: 20,
    marginVertical: 8,
    marginHorizontal: 16,
  },
  title: {
    fontSize: 32,
  },
});


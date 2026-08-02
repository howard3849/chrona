/*
 * Chrona bundled sample timeline
 *
 * Edit this file to review or change the timeline shown to new users and used
 * when a saved Google Sheet cannot be loaded. Keep it aligned with the
 * downloadable chrona-sample-timeline.xlsx starter workbook. This file contains
 * no Sheet URL and cannot read another user's browser storage.
 */
window.CHRONA_SAMPLE_DATA = {
  config: [
    { Key: 'language_baseline', Value: 'en' },
    { Key: 'language_available', Value: 'en,zh-TW,fr,es' },
    { Key: 'primary_groups', Value: 'United States' },
    { Key: 'group_color.United States', Value: '#2563EB' },
    { Key: 'group_color.China', Value: '#DC2626' },
    { Key: 'group_color.Ancient Rome', Value: '#7C3AED' },
    { Key: 'group_color.Britain', Value: '#D97706' },
    { Key: 'group_color.Germany', Value: '#475569' },
    { Key: 'never_translate.1', Value: 'Apollo 11' },
    { Key: 'never_translate.2', Value: 'iPhone' },
    { Key: 'dataset_name', Value: 'Chrona Sample Timeline' }
  ],
  categories: [],
  events: [
    { Year:'1776', Month:'7', Day:'4', 'Display Date':'July 4, 1776', Title:'U.S. Declaration of Independence', Description:'The thirteen colonies declared independence from Great Britain.', Media:'https://upload.wikimedia.org/wikipedia/commons/1/15/Declaration_independence.jpg', 'Media Credit':'Wikimedia Commons', 'Media Caption':'Declaration of Independence', Group:'United States', Type:'Event', Position:'Above', Importance:'Major', Color:'#2563EB', Visible:'TRUE', 'Event ID':'US-1776-DECLARATION' },
    { Year:'1787', Month:'9', Day:'17', 'Display Date':'September 17, 1787', Title:'U.S. Constitution Signed', Description:'Delegates signed the Constitution in Philadelphia.', Media:'https://upload.wikimedia.org/wikipedia/commons/4/4d/Scene_at_the_Signing_of_the_Constitution_of_the_United_States.jpg', 'Media Credit':'Wikimedia Commons', 'Media Caption':'Signing of the U.S. Constitution', Group:'United States', Type:'Event', Position:'Above', Importance:'Major', Color:'#2563EB', Visible:'TRUE', 'Event ID':'US-1787-CONSTITUTION' },
    { Year:'1839', 'End Year':'1842', 'Display Date':'1839–1842', Title:'First Opium War', Description:'Conflict between Qing China and Britain led to the Treaty of Nanking.', Media:'https://upload.wikimedia.org/wikipedia/commons/0/0e/Destroying_Chinese_war_junks%2C_by_E._Duncan_%281843%29.jpg', 'Media Credit':'Wikimedia Commons', 'Media Caption':'Naval battle during the First Opium War', Group:'China', Type:'Event', Position:'Below', Importance:'Major', Color:'#DC2626', Visible:'TRUE', 'Event ID':'CN-1839-OPIUM-WAR-1' },
    { Year:'1861', Month:'4', Day:'12', 'End Year':'1865', 'End Month':'4', 'End Day':'9', 'Display Date':'1861–1865', Title:'American Civil War', Description:'War between the Union and the Confederacy transformed the United States and ended legal slavery.', Media:'https://upload.wikimedia.org/wikipedia/commons/9/9a/Fall_of_Richmond_Va_on_the_night_of_April_2nd_1865.jpg', 'Media Credit':'Wikimedia Commons', 'Media Caption':'Richmond during the Civil War', Group:'United States', Type:'Event', Position:'Above', Importance:'Major', Color:'#2563EB', Visible:'TRUE', 'Event ID':'US-1861-CIVIL-WAR' },
    { Year:'1911', Month:'10', Day:'10', 'End Year':'1912', 'End Month':'2', 'End Day':'12', 'Display Date':'1911–1912', Title:'Xinhai Revolution', Description:'The revolution ended imperial rule and led to the establishment of the Republic of China.', Media:'https://upload.wikimedia.org/wikipedia/commons/8/8f/Wuchang_Uprising.jpg', 'Media Credit':'Wikimedia Commons', 'Media Caption':'Wuchang Uprising', Group:'China', Type:'Event', Position:'Below', Importance:'Major', Color:'#DC2626', Visible:'TRUE', 'Event ID':'CN-1911-XINHAI' },
    { Year:'1929', Month:'10', Day:'24', 'Display Date':'October 1929', Title:'Wall Street Crash', Description:'The stock-market collapse became a defining event of the Great Depression.', Media:'https://upload.wikimedia.org/wikipedia/commons/4/4c/Crowd_outside_nyse.jpg', 'Media Credit':'Wikimedia Commons', 'Media Caption':'Crowd outside the New York Stock Exchange', Group:'United States', Type:'Event', Position:'Above', Importance:'Medium', Color:'#2563EB', Visible:'TRUE', 'Event ID':'US-1929-WALL-STREET' },
    { Year:'1937', Month:'7', Day:'7', 'End Year':'1945', 'End Month':'9', 'End Day':'2', 'Display Date':'1937–1945', Title:'Second Sino-Japanese War', Description:'Full-scale war between China and Japan became part of the wider Second World War.', Media:'https://upload.wikimedia.org/wikipedia/commons/4/46/Chinese_soldiers_in_house_to_house_fighting_in_Tai%27er_zhuang.jpg', 'Media Credit':'Wikimedia Commons', 'Media Caption':'Chinese soldiers during the war', Group:'China', Type:'Event', Position:'Below', Importance:'Major', Color:'#DC2626', Visible:'TRUE', 'Event ID':'CN-1937-SINO-JAPANESE-WAR' },
    { Year:'1949', Month:'10', Day:'1', 'Display Date':'October 1, 1949', Title:'People’s Republic of China Founded', 'Title [zh-TW]':'中華人民共和國成立', Description:'Mao Zedong proclaimed the People’s Republic of China in Beijing.', Media:'https://upload.wikimedia.org/wikipedia/commons/5/51/Mao_Zedong_proclaiming_the_establishment_of_the_PRC_in_1949.jpg', 'Media Credit':'Wikimedia Commons', 'Media Caption':'Proclamation ceremony in Beijing', Group:'China', Type:'Event', Position:'Below', Importance:'Major', Color:'#DC2626', Visible:'TRUE', 'Event ID':'CN-1949-PRC' },
    { Year:'1969', Month:'7', Day:'20', 'Display Date':'July 20, 1969', Title:'Apollo 11 Moon Landing', 'Title [zh-TW]':'Apollo 11 登月', Description:'Neil Armstrong and Buzz Aldrin became the first people to walk on the Moon.', Media:'https://upload.wikimedia.org/wikipedia/commons/9/98/Aldrin_Apollo_11_original.jpg', 'Media Credit':'NASA / Wikimedia Commons', 'Media Caption':'Buzz Aldrin on the Moon', Group:'United States', Type:'Event', Position:'Above', Importance:'Major', Color:'#2563EB', Visible:'TRUE', 'Event ID':'US-1969-APOLLO-11' },
    { Year:'1978', Month:'12', Day:'18', 'Display Date':'December 1978', Title:'China Begins Reform and Opening', Description:'The Third Plenum marked the beginning of major economic reform under Deng Xiaoping.', Media:'https://upload.wikimedia.org/wikipedia/commons/5/5c/Deng_Xiaoping_1979.jpg', 'Media Credit':'Wikimedia Commons', 'Media Caption':'Deng Xiaoping', Group:'China', Type:'Event', Position:'Below', Importance:'Major', Color:'#DC2626', Visible:'TRUE', 'Event ID':'CN-1978-REFORM' },
    { Year:'-27', 'End Year':'476', 'Display Date':'27 BCE–476 CE', Title:'Roman Empire (Western)', Description:'Reference period spanning the Roman imperial era in the West.', Group:'Ancient Rome', Type:'Period', Position:'Below', Importance:'Major', Color:'#7C3AED', Visible:'TRUE', 'Event ID':'ROME-0027BCE-0476' },
    { Year:'1707', 'End Year':'1997', 'Display Date':'1707–1997', Title:'British Empire (broad reference period)', Description:'A simplified reference span for Britain’s imperial period.', Group:'Britain', Type:'Period', Position:'Below', Importance:'Major', Color:'#D97706', Visible:'TRUE', 'Event ID':'GB-1707-1997-EMPIRE' },
    { Year:'1933', 'End Year':'1945', 'Display Date':'1933–1945', Title:'Nazi Regime', Description:'Period during which Adolf Hitler and the Nazi Party ruled Germany.', Group:'Germany', Type:'Period', Position:'Below', Importance:'Major', Color:'#475569', Visible:'TRUE', 'Event ID':'DE-1933-1945-NAZI' },
    { Year:'1644', 'End Year':'1912', 'Display Date':'1644–1912', Title:'Qing Dynasty', 'Title [zh-TW]':'清朝', Description:'China’s final imperial dynasty, used here as a long-duration reference block.', Group:'China', Type:'Period', Position:'Below', Importance:'Major', Color:'#DC2626', Visible:'TRUE', 'Event ID':'CN-1644-1912-QING' }
  ]
};
